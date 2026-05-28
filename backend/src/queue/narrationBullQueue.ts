import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import type { NarrationJobPayload } from './narrationJobQueue.js';
import { executeNarrationJob } from './narrationJobProcessor.js';
import { sendToUser } from '../websocket/wsConnectionRegistry.js';

export const NARRATION_BULL_QUEUE_NAME = 'dndai-narration';

let narrationQueue: Queue<NarrationJobPayload> | null = null;
let narrationWorker: Worker<NarrationJobPayload> | null = null;

function buildRedisConnection(): ConnectionOptions | null {
    const url = process.env.REDIS_URL;
    if (!url || url === 'mock') return null;
    return { url, maxRetriesPerRequest: null };
}

export function getNarrationBullQueue(): Queue<NarrationJobPayload> | null {
    const connection = buildRedisConnection();
    if (!connection) return null;
    if (!narrationQueue) {
        narrationQueue = new Queue<NarrationJobPayload>(NARRATION_BULL_QUEUE_NAME, { connection });
    }
    return narrationQueue;
}

export async function enqueueNarrationJobBull(job: NarrationJobPayload): Promise<boolean> {
    const queue = getNarrationBullQueue();
    if (!queue) return false;
    const critical = job.criticality === 'critical';
    await queue.add('narrate', job, {
        jobId: `${job.sessionId}:${job.actionId}`,
        removeOnComplete: 100,
        removeOnFail: 50,
        ...(critical
            ? {
                  attempts: Number(process.env.NARRATION_CRITICAL_ATTEMPTS ?? 5) || 5,
                  backoff: {
                      type: 'exponential',
                      delay: Number(process.env.NARRATION_CRITICAL_BACKOFF_MS ?? 2000) || 2000,
                  },
              }
            : {}),
    });
    return true;
}

export function startBullNarrationWorker(): void {
    if (narrationWorker) return;
    const connection = buildRedisConnection();
    if (!connection) {
        console.warn('[narrationBull] Redis indisponível — narração síncrona como fallback nos handlers.');
        return;
    }
    const concurrency = Number(process.env.NARRATION_BULL_CONCURRENCY ?? 2);
    narrationWorker = new Worker<NarrationJobPayload>(
        NARRATION_BULL_QUEUE_NAME,
        async bullJob => {
            try {
                await executeNarrationJob(bullJob.data);
            } catch (err) {
                const attempts = bullJob.opts.attempts ?? 1;
                const attempt = (bullJob.attemptsMade ?? 0) + 1;
                const isFinalAttempt = attempt >= attempts;

                console.error('[narrationBull] job falhou:', bullJob.id, {
                    attempt,
                    attempts,
                    error: err instanceof Error ? err.message : String(err),
                });

                if (isFinalAttempt) {
                    // Só notifica o cliente no último attempt; antes disso o BullMQ vai reprocessar.
                    sendToUser(bullJob.data.userId, {
                        type: 'error',
                        payload: {
                            message: 'Falha na narração assíncrona.',
                            actionId: bullJob.data.actionId,
                            actionSequence: bullJob.data.actionSequence,
                        },
                    });
                    sendToUser(bullJob.data.userId, {
                        type: 'stopLoading',
                        payload: {
                            actionId: bullJob.data.actionId,
                            actionSequence: bullJob.data.actionSequence,
                        },
                    });
                }

                // Re-throw para que o BullMQ conte a falha e aplique retry/backoff.
                throw err;
            }
        },
        { connection, concurrency: Number.isFinite(concurrency) ? concurrency : 2 },
    );
    narrationWorker.on('failed', (job, err) => {
        console.error('[narrationBull] job falhou:', job?.id, err?.message);
    });
    console.log(`[narrationBull] worker ativo (concurrency=${concurrency})`);
}

export async function closeBullNarration(): Promise<void> {
    await narrationWorker?.close();
    await narrationQueue?.close();
    narrationWorker = null;
    narrationQueue = null;
}
