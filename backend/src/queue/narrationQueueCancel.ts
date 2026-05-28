import type { Job } from 'bullmq';
import type { NarrationJobPayload } from './narrationJobQueue.js';
import { getNarrationBullQueue } from './narrationBullQueue.js';
import { sendToUser } from '../websocket/wsConnectionRegistry.js';
import { instrumentGameEvent } from '../services/gameEventInstrumentation.js';
import { logPipelineTrace } from '../telemetry/pipelineTrace.js';

const CANCEL_SCAN_STATES = ['wait', 'waiting', 'delayed', 'paused'] as const;

export function shouldCancelNarrationJob(
    job: Pick<NarrationJobPayload, 'sessionId' | 'actionSequence'>,
    sessionId: number,
    latestSequence: number,
): boolean {
    if (job.sessionId !== sessionId) return false;
    const seq = job.actionSequence;
    if (seq == null || !Number.isFinite(seq)) return false;
    return seq < latestSequence;
}

export type CancelledNarrationJob = {
    actionId: string;
    actionSequence: number;
    jobId?: string;
};

/**
 * P4.3 — Remove jobs waiting/delayed com sequence menor que o atual.
 * Jobs já em execução são abortados no worker via isStaleNarrationSequence.
 */
export async function cancelStaleNarrationJobsForSession(
    sessionId: number,
    latestSequence: number,
): Promise<CancelledNarrationJob[]> {
    const queue = getNarrationBullQueue();
    if (!queue || latestSequence <= 0) return [];

    const cancelled: CancelledNarrationJob[] = [];

    for (const state of CANCEL_SCAN_STATES) {
        let jobs: Job<NarrationJobPayload>[];
        try {
            jobs = await queue.getJobs([state], 0, 250);
        } catch (err) {
            console.warn('[narrationQueueCancel] falha ao listar jobs:', state, err);
            continue;
        }

        for (const job of jobs) {
            const data = job.data;
            if (!shouldCancelNarrationJob(data, sessionId, latestSequence)) continue;

            try {
                await job.remove();
                cancelled.push({
                    actionId: data.actionId,
                    actionSequence: data.actionSequence as number,
                    jobId: job.id,
                });
                logPipelineTrace('narration:job:cancelled', {
                    sessionId,
                    actionId: data.actionId,
                    actionSequence: data.actionSequence,
                    latestSequence,
                    bullState: state,
                    jobId: job.id,
                });
            } catch (removeErr) {
                console.warn('[narrationQueueCancel] não removeu job', job.id, removeErr);
            }
        }
    }

    if (cancelled.length) {
        instrumentGameEvent(sessionId, 'NarrationCancelled', {
            payload: {
                latestSequence,
                count: cancelled.length,
                actionIds: cancelled.map(c => c.actionId),
            },
        });
    }

    return cancelled;
}

/** Notifica cliente que narrações antigas foram invalidadas (libera loading). */
export function notifyNarrationJobsCancelled(
    userId: number,
    cancelled: CancelledNarrationJob[],
): void {
    for (const entry of cancelled) {
        sendToUser(userId, {
            type: 'narrationCancelled',
            payload: {
                actionId: entry.actionId,
                actionSequence: entry.actionSequence,
                reason: 'superseded',
            },
        });
        sendToUser(userId, {
            type: 'stopLoading',
            payload: { actionId: entry.actionId, actionSequence: entry.actionSequence },
        });
    }
}
