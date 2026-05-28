import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import type { NarrationJobPayload } from './narrationJobQueue.js';
import { executeNarrationJobSafe } from './narrationJobProcessor.js';

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
    await queue.add('narrate', job, {
        jobId: `${job.sessionId}:${job.actionId}`,
        removeOnComplete: 100,
        removeOnFail: 50,
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
            await executeNarrationJobSafe(bullJob.data);
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
