import type { NarrationJobPayload } from './narrationJobQueue.js';
import { sendToUser } from '../websocket/wsConnectionRegistry.js';
import { recordNarrationLatencyMs } from '../telemetry/pipelineLatency.js';
import { instrumentGameEvent } from '../services/gameEventInstrumentation.js';
import { isStaleNarrationSequence } from '../services/actionSequenceService.js';
import { isNarrationPersistenceCompleted } from '../services/narrationIdempotencyService.js';
import { logActionFlow } from '../action-pipeline/context.js';
import { logPipelineTrace } from '../telemetry/pipelineTrace.js';

function enrichWsPayload<T extends Record<string, unknown>>(
    payload: T,
    job: NarrationJobPayload,
): T & { actionSequence?: number; actionId?: string } {
    return {
        ...payload,
        actionId: job.actionId,
        ...(job.actionSequence != null ? { actionSequence: job.actionSequence } : {}),
    };
}

async function abortStaleOrDuplicateJob(job: NarrationJobPayload, reason: string): Promise<boolean> {
    logActionFlow('narration:job:skipped', {
        sessionId: job.sessionId,
        actionId: job.actionId,
        actionSequence: job.actionSequence ?? null,
        reason,
    });
    instrumentGameEvent(job.sessionId, 'NarrationSkipped', {
        actionId: job.actionId,
        payload: { reason, actionSequence: job.actionSequence ?? null },
    });
    sendToUser(job.userId, {
        type: 'stopLoading',
        payload: enrichWsPayload({}, job),
    });
    return true;
}

async function processRollNarrationJob(job: NarrationJobPayload): Promise<void> {
    if (job.kind !== 'roll' || !job.pending || !job.diceValues?.length) {
        await processPlayerActionJob(job);
        return;
    }

    if (!(await assertJobStillValid(job, 'pre_llm_roll'))) return;

    const t0 = performance.now();
    const { completeManualRollAndNarrate } = await import('../services/dm/dmTurnOrchestrator.js');
    const { applyMotorPostRollEffects } = await import('../services/motorPostRollService.js');
    const { bumpSessionStateVersion } = await import('../action-pipeline/context.js');
    const { AppDataSource } = await import('../database/data-source.js');
    const { SessaoIA } = await import('../entities/SessaoIA.js');

    const response = await completeManualRollAndNarrate({
        sessionId: job.sessionId,
        userId: job.userId,
        apiKey: job.apiKey,
        pending: job.pending,
        diceValues: job.diceValues,
        combatState: job.combatState as never,
        useAiHomebrew: job.useAiHomebrew,
        resolutionResult: job.resolutionResult ?? null,
        narrationTts: { narrationVoice: job.narrationVoice, narrationSpeed: job.narrationSpeed },
        actionSequence: job.actionSequence,
    });

    const newStateVersion = await bumpSessionStateVersion(job.sessionId);
    const enrichedResponse = {
        ...response,
        stateVersion: newStateVersion,
        actionSequence: job.actionSequence,
        updatedCharacter: job.resolutionResult?.updatedCharacter,
        updatedEntities: job.resolutionResult?.updatedEntity ? [job.resolutionResult.updatedEntity] : undefined,
    };

    try {
        const sessaoRow = await AppDataSource.getRepository(SessaoIA).findOne({
            where: { id: job.sessionId },
            select: ['id', 'characterId'],
        });
        const postRoll = await applyMotorPostRollEffects({
            sessionId: job.sessionId,
            pending: job.pending,
            total: job.rollTotal ?? 0,
            resolutionResult: job.resolutionResult ?? null,
            combatState: job.combatState as never,
        });
        if (postRoll.motorCombat?.publicState !== undefined) {
            enrichedResponse.combatState = postRoll.motorCombat.publicState as typeof enrichedResponse.combatState;
        }
        if (postRoll.motorCombat?.rewards?.lootOffer) {
            enrichedResponse.lootOffer = postRoll.motorCombat.rewards.lootOffer;
        }
        void sessaoRow;
    } catch (err) {
        console.warn('[narrationJobProcessor] motor pós-rolagem:', err);
    }

    recordNarrationLatencyMs(performance.now() - t0);
    instrumentGameEvent(job.sessionId, 'NarrationCompleted', {
        actionId: job.actionId,
        stateVersion: newStateVersion,
        payload: { actionSequence: job.actionSequence ?? null },
    });

    if (!(await assertJobStillValid(job, 'pre_deliver_roll'))) return;

    logPipelineTrace('narration:worker:deliver', {
        traceId: job.actionId,
        sessionId: job.sessionId,
        actionId: job.actionId,
        actionSequence: job.actionSequence ?? null,
        kind: 'roll',
    });

    sendToUser(job.userId, { type: 'gameStateUpdate', payload: enrichedResponse });
    sendToUser(job.userId, { type: 'narrationComplete', payload: enrichWsPayload({}, job) });
    sendToUser(job.userId, { type: 'stopLoading', payload: enrichWsPayload({}, job) });
}

async function processPlayerActionJob(job: NarrationJobPayload): Promise<void> {
    if (!(await assertJobStillValid(job, 'pre_llm_action'))) return;

    const t0 = performance.now();
    const { processPlayerTurn } = await import('../services/narrarService.js');
    const response = await processPlayerTurn(
        job.sessionId,
        job.userId,
        job.playerAction,
        job.apiKey,
        job.combatState as never,
        job.useAiHomebrew,
        undefined,
        job.actionId,
        { narrationVoice: job.narrationVoice, narrationSpeed: job.narrationSpeed },
        job.actionSequence,
    );
    recordNarrationLatencyMs(performance.now() - t0);
    instrumentGameEvent(job.sessionId, 'NarrationCompleted', {
        actionId: job.actionId,
        stateVersion: response.stateVersion ?? null,
        payload: { actionSequence: job.actionSequence ?? null },
    });
    if (!(await assertJobStillValid(job, 'pre_deliver_action'))) return;

    logPipelineTrace('narration:worker:deliver', {
        traceId: job.actionId,
        sessionId: job.sessionId,
        actionId: job.actionId,
        actionSequence: job.actionSequence ?? null,
        kind: job.kind ?? 'action',
    });

    const outbound = {
        ...response,
        actionSequence: job.actionSequence,
    };
    sendToUser(job.userId, { type: 'gameStateUpdate', payload: outbound });
    sendToUser(job.userId, { type: 'narrationComplete', payload: enrichWsPayload({}, job) });
    sendToUser(job.userId, { type: 'stopLoading', payload: enrichWsPayload({}, job) });
}

async function assertJobStillValid(job: NarrationJobPayload, stage: string): Promise<boolean> {
    if (await isStaleNarrationSequence(job.sessionId, job.actionSequence)) {
        await abortStaleOrDuplicateJob(job, `stale_sequence:${stage}`);
        return false;
    }
    if (await isNarrationPersistenceCompleted(job.sessionId, job.actionId)) {
        await abortStaleOrDuplicateJob(job, 'already_persisted');
        return false;
    }
    return true;
}

/** Processa um job de narração (BullMQ). */
export async function executeNarrationJob(job: NarrationJobPayload): Promise<void> {
    logPipelineTrace('narration:worker:start', {
        traceId: job.actionId,
        sessionId: job.sessionId,
        userId: job.userId,
        actionId: job.actionId,
        actionSequence: job.actionSequence ?? null,
        kind: job.kind,
    });

    if (!(await assertJobStillValid(job, 'pre_run'))) return;

    if (job.kind === 'roll') {
        await processRollNarrationJob(job);
    } else {
        await processPlayerActionJob(job);
    }
}

export async function executeNarrationJobSafe(job: NarrationJobPayload): Promise<void> {
    try {
        await executeNarrationJob(job);
    } catch (err) {
        console.error('[narrationJobProcessor] falha:', err);
        instrumentGameEvent(job.sessionId, 'NarrationFailed', {
            actionId: job.actionId,
            payload: { error: err instanceof Error ? err.message : String(err) },
        });
        sendToUser(job.userId, {
            type: 'error',
            payload: {
                message: 'Falha na narração assíncrona.',
                actionId: job.actionId,
                actionSequence: job.actionSequence,
            },
        });
        sendToUser(job.userId, { type: 'stopLoading', payload: enrichWsPayload({}, job) });
    }
}
