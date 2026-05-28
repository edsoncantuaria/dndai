import type { WebSocket } from 'ws';
import { enqueueNarrationJob, isNarrationQueueAvailable, type NarrationJobPayload } from './narrationJobQueue.js';
import { emitMechanicalStateUpdate, type MechanicalStatePayload } from '../websocket/mechanicalUpdate.js';
import { recordGameEvent } from '../events/recordGameEvent.js';
import { instrumentGameEvent } from '../services/gameEventInstrumentation.js';
import type { GameMasterResponse } from '../schemas/gameSchemas.js';

export const NARRATION_QUEUED_MARKER = '[pipeline:narration-queued]';

export function isNarrationQueuedResponse(response: GameMasterResponse): boolean {
    return response.systemLog === NARRATION_QUEUED_MARKER;
}

export function buildQueuedNarrationAck(): GameMasterResponse {
    return {
        logEntries: [],
        actionOptions: [],
        systemLog: NARRATION_QUEUED_MARKER,
    };
}

type DispatchOpts = {
    ws?: WebSocket;
    sessionId: number;
    userId: number;
    actionId: string;
    job: Omit<NarrationJobPayload, 'sessionId' | 'userId' | 'actionId' | 'apiKey'> & {
        apiKey: string;
    };
    mechanicalPayload?: MechanicalStatePayload;
    stateVersion?: number;
    releaseRollRequestId?: string;
};

/** Enfileira narração + notifica o cliente. Retorna false só sem Redis (testes). */
export async function dispatchNarrationToQueue(opts: DispatchOpts): Promise<boolean> {
    if (!isNarrationQueueAvailable()) return false;

    const { allocateActionSequence } = await import('../services/actionSequenceService.js');
    const { cancelStaleNarrationJobsForSession, notifyNarrationJobsCancelled } = await import(
        './narrationQueueCancel.js'
    );
    const { logPipelineTrace } = await import('../telemetry/pipelineTrace.js');

    const actionSequence = await allocateActionSequence(opts.sessionId);

    const cancelled = await cancelStaleNarrationJobsForSession(opts.sessionId, actionSequence);
    if (cancelled.length) {
        notifyNarrationJobsCancelled(opts.userId, cancelled);
    }

    logPipelineTrace('narration:dispatch', {
        traceId: opts.actionId,
        sessionId: opts.sessionId,
        userId: opts.userId,
        actionId: opts.actionId,
        actionSequence,
        cancelledJobs: cancelled.length,
    });

    if (opts.mechanicalPayload && opts.ws) {
        await emitMechanicalStateUpdate(opts.ws, opts.sessionId, {
            ...opts.mechanicalPayload,
            actionSequence,
        });
    }

    const enqueued = await enqueueNarrationJob({
        ...opts.job,
        sessionId: opts.sessionId,
        userId: opts.userId,
        actionId: opts.actionId,
        actionSequence,
    });

    if (!enqueued) return false;

    void recordGameEvent({
        sessionId: opts.sessionId,
        actionId: opts.actionId,
        type: 'NarrationRequested',
        stateVersion: opts.stateVersion ?? null,
        payload: { asyncQueue: true, actionSequence },
    }).catch(() => undefined);

    if (opts.ws) {
        opts.ws.send(
            JSON.stringify({
                type: 'narrationLoading',
                payload: { actionId: opts.actionId, actionSequence },
            }),
        );
        opts.ws.send(
            JSON.stringify({
                type: 'narrationQueued',
                payload: {
                    actionId: opts.actionId,
                    sessionId: opts.sessionId,
                    actionSequence,
                },
            }),
        );
        if (opts.releaseRollRequestId) {
            const { emitActionRelease } = await import('../action-pipeline/context.js');
            emitActionRelease(opts.ws, opts.releaseRollRequestId);
        }
    }

    instrumentGameEvent(opts.sessionId, 'NarrationRequested', {
        actionId: opts.actionId,
        stateVersion: opts.stateVersion ?? null,
        payload: { dispatched: true, actionSequence },
    });

    return true;
}
