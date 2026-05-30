import { buildNarrativeContextPack } from '../memory/narrativePack.js';
import { defaultProviders } from '../adapters/index.js';
import { assertNarrationPtBr } from '../locale/narrationGuard.js';
import { appendWorldEvent } from '../events/store.js';
import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { storeSessionMemory, storeWorldMemory } from '../memory/store.js';
import { maybeScheduleMemoryCompaction } from '../memory/narrativeMemory.js';
import { formatMechanicalPack } from '../character/formatMechanicalPack.js';
import { suggestActionOptionsForTurn } from './suggestActionOptions.js';
import type { MotorActionOption } from '../motor/actionOptionTypes.js';
import { buildContextualActionOptions } from '../motor/contextualActionOptions.js';
import { saveLastActionOptions } from '../sessions/sessionUiState.js';
import { publishWsToUser } from '../transport/wsPubSub.js';
import { completePenaiTurnNarration, rollbackPenaiTurnOnNarrationFailure } from '../motor/turnLock.js';
import {
    resolveInferenceApiKey,
    consumePlatformNarrationCredit,
    isPlatformBillingEnabled,
} from '../../services/aiBillingService.js';
import {
    shouldAllowPenaiCombatNarration,
    advancePenaiCombatPhaseAfterNarration,
    getActivePenaiCombatPhase,
} from '../combat/phaseGate.js';
import {
    penaiPipelineLog,
    penaiPipelineWait,
} from '../infra/pipelineLog.js';
import {
    composeSystemPrompt,
    estimatePromptChars,
    inferSceneMode,
    slimNarrationPack,
} from '../ai/promptComposer.js';
import {
    buildTurnOrchestrationBrief,
    orchestrationToPayload,
} from '../ai/turnOrchestration.js';
import { applyLazyNpcLootFromNarration } from '../world/npcNarrationLoot.js';
import { isNonRecoverableNarrationError } from '../ai/geminiStructured.js';

async function abortPenaiTurnNarration(opts: {
    sessionId: number;
    userId: number;
    actionId: string;
    actionSequence: number;
    message: string;
    ctx: {
        sessionId: number;
        userId: number;
        actionId: string;
        actionSequence: number;
    };
}): Promise<TurnPipelineResult> {
    const rolled = await rollbackPenaiTurnOnNarrationFailure(opts.sessionId, opts.actionSequence);

    await appendWorldEvent({
        type: 'NARRATION_FAILED',
        sessionId: opts.sessionId,
        payload: {
            actionId: opts.actionId,
            actionSequence: opts.actionSequence,
            error: opts.message,
            rolledBack: true,
        },
    });

    penaiPipelineLog(
        'NARRATION',
        'turno revertido — narração indisponível',
        { error: opts.message, actionSequence: rolled?.actionSequence },
        opts.ctx,
    );

    await publishWsToUser(opts.userId, {
        type: 'narrationFailed',
        contractVersion: 2,
        sessionId: opts.sessionId,
        actionId: opts.actionId,
        actionSequence: opts.actionSequence,
        actionCursor: rolled?.actionCursor ?? 0,
        stateVersion: rolled?.stateVersion,
        message: opts.message,
        locale: 'pt-BR',
    });

    return { narration: '', actionOptions: [] };
}

export type TurnPipelineInput = {
    sessionId: number;
    userId: number;
    playerAction: string;
    actionSequence: number;
    actionId: string;
    rollSummary?: string;
    motorHints?: string[];
    intentType?: string;
};

export type TurnPipelineResult = {
    narration: string;
    tone?: string;
    actionOptions: MotorActionOption[];
};

/** Orquestrador enxuto: pack → narrate → persist → WS → complete turn. */
export async function runTurnPipeline(input: TurnPipelineInput): Promise<TurnPipelineResult> {
    const ctx = {
        sessionId: input.sessionId,
        userId: input.userId,
        actionId: input.actionId,
        actionSequence: input.actionSequence,
    };
    penaiPipelineLog('NARRATION', 'runTurnPipeline início', { playerAction: input.playerAction.slice(0, 120) }, ctx);

    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: input.sessionId },
    });
    if (!session) throw new Error('Sessão não encontrada');

    const narrationAllowed = await shouldAllowPenaiCombatNarration(input.sessionId);
    if (!narrationAllowed) {
        await appendWorldEvent({
            type: 'COMBAT_NARRATION_DEFERRED',
            sessionId: input.sessionId,
            payload: {
                actionId: input.actionId,
                actionSequence: input.actionSequence,
                phase: await getActivePenaiCombatPhase(input.sessionId),
            },
        });
        await completePenaiTurnNarration(input.sessionId, input.actionSequence);
        return { narration: '', actionOptions: [] };
    }

    penaiPipelineWait('NARRATION', 'montando context pack (memória + região)…', ctx);
    const pack = await buildNarrativeContextPack({
        sessionId: input.sessionId,
        playerAction: input.playerAction,
        regionSlug: session.currentRegionSlug,
        rollSummary: input.rollSummary,
        motorHints: input.motorHints,
    });
    const sceneMode = inferSceneMode({
        playerAction: input.playerAction,
        combatPhase: pack.combatPhase,
        intentType: input.intentType,
    });
    const orchestration = buildTurnOrchestrationBrief({
        pack,
        sceneMode,
        intentType: input.intentType,
    });
    const userPayload = slimNarrationPack(pack, {
        orquestracao: orchestrationToPayload(orchestration),
    });
    const systemPreview = composeSystemPrompt({ role: 'narrator', sceneMode });
    penaiPipelineLog(
        'NARRATION',
        'context pack pronto',
        {
            region: session.currentRegionSlug,
            sceneMode,
            promptChars: estimatePromptChars(systemPreview, userPayload),
        },
        ctx,
    );

    maybeScheduleMemoryCompaction({
        sessionId: input.sessionId,
        actionSequence: input.actionSequence,
    });

    const userApiKey = await resolveInferenceApiKey(input.userId);
    if (isPlatformBillingEnabled()) {
        const ok = await consumePlatformNarrationCredit(input.userId);
        if (!ok) {
            return abortPenaiTurnNarration({
                sessionId: input.sessionId,
                userId: input.userId,
                actionId: input.actionId,
                actionSequence: input.actionSequence,
                message: 'Créditos de IA esgotados.',
                ctx,
            });
        }
    }

    let narration = '';
    let tone: string | undefined;
    let lastError = 'Narração indisponível.';
    let fatal = false;

    for (let attempt = 0; attempt < 3; attempt++) {
        penaiPipelineWait('NARRATION', `Gemini narração tentativa ${attempt + 1}/3…`, ctx);
        const t0 = performance.now();
        try {
            const out = await defaultProviders.narration.render(userPayload, {
                userApiKey: userApiKey ?? undefined,
                sceneMode,
            });
            penaiPipelineLog(
                'NARRATION',
                `Gemini respondeu (${Math.round(performance.now() - t0)}ms)`,
                { tone: out.tone, preview: out.narration.slice(0, 200) },
                ctx,
            );
            const guard = assertNarrationPtBr(out.narration);
            if (guard.ok) {
                narration = out.narration;
                tone = out.tone;
                break;
            }
            lastError = guard.reason ?? 'Narração fora do padrão pt-BR.';
        } catch (err) {
            lastError = err instanceof Error ? err.message : String(err);
            penaiPipelineLog(
                'NARRATION',
                `tentativa ${attempt + 1} falhou`,
                { error: lastError },
                ctx,
            );
            if (isNonRecoverableNarrationError(err)) {
                fatal = true;
                break;
            }
        }
    }

    if (!narration.trim()) {
        return abortPenaiTurnNarration({
            sessionId: input.sessionId,
            userId: input.userId,
            actionId: input.actionId,
            actionSequence: input.actionSequence,
            message: fatal
                ? lastError
                : `${lastError} Tente novamente em instantes.`,
            ctx,
        });
    }

    const storyTone =
        input.intentType === 'opening' || sceneMode === 'opening' ? 'opening' : tone;
    const memoryRow = await storeSessionMemory({
        sessionId: input.sessionId,
        text: narration,
        actionSequence: input.actionSequence,
        storyKind: 'narration',
        storyTone,
        importanceScore: 35,
    });

    const leadNpc = pack.entities.find(e => e.entityType === 'npc');
    if (leadNpc) {
        void applyLazyNpcLootFromNarration({
            sessionId: input.sessionId,
            worldEntityId: leadNpc.id,
            narration,
        }).catch(() => undefined);
    }

    await appendWorldEvent({
        type: 'NARRATION_COMPLETED',
        sessionId: input.sessionId,
        payload: { actionId: input.actionId, actionSequence: input.actionSequence, tone },
        canonCandidate: true,
    });
    await appendWorldEvent({
        type: 'TURN_NARRATED',
        sessionId: input.sessionId,
        payload: { actionId: input.actionId, actionSequence: input.actionSequence },
    });

    const { penaiEnv } = await import('../../config/penaiEnv.js');
    if (penaiEnv.PENAI_NARRATION_TO_GLOBAL_RAG) {
        void storeWorldMemory({
            sessionId: input.sessionId,
            text: narration,
            regionSlug: session.currentRegionSlug,
        }).catch(() => undefined);
    }

    const mechanical = await formatMechanicalPack(input.sessionId);
    const char = mechanical.character as {
        skillProficiencies?: string[];
        spells?: string[];
    } | null;
    let actionOptions: MotorActionOption[];
    try {
        actionOptions = await suggestActionOptionsForTurn({
            sessionId: input.sessionId,
            lastNarration: narration,
            pack,
            userApiKey: userApiKey ?? undefined,
            proficientSkills: char?.skillProficiencies,
            knownSpells: char?.spells,
            combatActive: Boolean((mechanical.combatState as { isActive?: boolean })?.isActive),
            ctx,
        });
    } catch (err) {
        penaiPipelineLog(
            'ACTION_OPTIONS',
            'agente falhou — fallback mecânico',
            { error: err instanceof Error ? err.message : String(err) },
            ctx,
        );
        actionOptions = buildContextualActionOptions({
            domain: 'exploration',
            proficientSkills: char?.skillProficiencies,
            knownSpells: char?.spells,
        }) as MotorActionOption[];
    }

    await saveLastActionOptions(input.sessionId, actionOptions);

    const timeLabel = new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    });

    penaiPipelineLog('NARRATION', 'enviando storyFeed + opções + narrationComplete', {
        chars: narration.length,
        options: actionOptions.length,
    }, ctx);

    await publishWsToUser(input.userId, {
        type: 'storyFeed',
        contractVersion: 2,
        sessionId: input.sessionId,
        actionId: input.actionId,
        actionSequence: input.actionSequence,
        locale: 'pt-BR',
        entries: [
            {
                id: memoryRow?.id,
                timestamp: timeLabel,
                content: narration,
                tone: storyTone,
                kind: 'narration',
                consequences: [],
            },
        ],
    });

    await publishWsToUser(input.userId, {
        type: 'gameStateUpdate',
        contractVersion: 2,
        sessionId: input.sessionId,
        actionId: input.actionId,
        actionSequence: input.actionSequence,
        locale: 'pt-BR',
        mechanical: { ...mechanical, actionOptions },
        actionOptions,
        payload: {
            logEntries: [{ type: 'narrative', content: narration, tone }],
            actionOptions,
        },
    });

    await completePenaiTurnNarration(input.sessionId, input.actionSequence);
    await advancePenaiCombatPhaseAfterNarration(input.sessionId);

    await publishWsToUser(input.userId, {
        type: 'narrationComplete',
        contractVersion: 2,
        sessionId: input.sessionId,
        actionId: input.actionId,
        actionSequence: input.actionSequence,
        locale: 'pt-BR',
        payload: {
            logEntries: [{ type: 'narrative', content: narration, tone }],
            actionOptions,
        },
    });

    return { narration, tone, actionOptions };
}
