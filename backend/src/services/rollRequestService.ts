// backend/src/services/rollRequestService.ts
import createError from 'http-errors';
import { PlayerRollRequest } from '../types.js';
import redisClient from '../database/redis-client.js';
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { recordRollEmission, clearRollEmission, updateRollQueueSize } from './rollMetricsService.js';

const ROLL_KEY = (sessionId: number) => `session:${sessionId}:pendingRoll`;
const ROLL_QUEUE_KEY = (sessionId: number) => `session:${sessionId}:rollQueue`;
const TTL_SECONDS = 60 * 15; // 15 minutes

export interface RollRequestContext {
    actionId?: string;
    intentType?: string;
    intentPayload?: Record<string, any>;
    metadata?: Record<string, any>;
}

type StoredRollRequest = PlayerRollRequest & {
    requestId: string;
    sessionId: number;
    userId: number;
    createdAt: number;
    context?: RollRequestContext;
};

const memoryStore = new Map<number, StoredRollRequest>();
const memoryQueueStore = new Map<number, RollQueueEntry[]>();
let forceMemoryOnly = false;

const canUseRedis = () => !forceMemoryOnly && !!redisClient && redisClient.isOpen;

interface RollQueueEntry {
    rollId: string;
    actionId?: string;
    intentType?: string;
    metadata?: Record<string, any>;
    createdAt: number;
}

const readQueue = async (sessionId: number): Promise<RollQueueEntry[]> => {
    if (canUseRedis()) {
        const raw = await redisClient!.get(ROLL_QUEUE_KEY(sessionId));
        if (!raw) return [];
        try {
            return JSON.parse(raw) as RollQueueEntry[];
        } catch (error) {
            console.warn('[rollRequestService] Falha ao interpretar rollQueue, limpando chave.', error);
            await redisClient!.del(ROLL_QUEUE_KEY(sessionId));
            return [];
        }
    }
    return memoryQueueStore.get(sessionId) ?? [];
};

const writeQueue = async (sessionId: number, queue: RollQueueEntry[]) => {
    if (canUseRedis()) {
        if (queue.length) {
            await redisClient!.set(ROLL_QUEUE_KEY(sessionId), JSON.stringify(queue), { EX: TTL_SECONDS });
        } else {
            await redisClient!.del(ROLL_QUEUE_KEY(sessionId));
        }
    } else if (queue.length) {
        memoryQueueStore.set(sessionId, queue);
    } else {
        memoryQueueStore.delete(sessionId);
    }
    updateRollQueueSize(sessionId, queue.length);
};

const enqueueRollQueueEntry = async (sessionId: number, entry: RollQueueEntry) => {
    const queue = await readQueue(sessionId);
    if (!queue.length) {
        queue.push(entry);
        await writeQueue(sessionId, queue);
        return entry;
    }
    const head = queue[0];
    if (head.rollId === entry.rollId) {
        queue[0] = entry;
        await writeQueue(sessionId, queue);
        return head;
    }
    throw createError(409, 'ROLL_IN_PROGRESS');
};

const dequeueRollQueueHead = async (sessionId: number, rollId?: string) => {
    const queue = await readQueue(sessionId);
    if (!queue.length) return null;
    const head = queue[0];
    if (rollId && head.rollId !== rollId) {
        console.warn('[rollRequestService] Roll queue head não corresponde ao roll resolvido.', {
            sessionId,
            expectedRollId: head.rollId,
            receivedRollId: rollId,
        });
    }
    queue.shift();
    await writeQueue(sessionId, queue);
    return head;
};

export const savePendingRollRequest = async (
    sessionId: number,
    userId: number,
    request: PlayerRollRequest & { requestId: string },
    context?: RollRequestContext
) => {
    recordRollEmission(sessionId, context?.actionId, context?.intentType);
    await enqueueRollQueueEntry(sessionId, {
        rollId: request.requestId,
        actionId: context?.actionId,
        intentType: context?.intentType,
        metadata: context?.metadata ?? request.metadata,
        createdAt: Date.now(),
    });

    const payload: StoredRollRequest = {
        ...request,
        sessionId,
        userId,
        createdAt: Date.now(),
        context,
    };

    if (canUseRedis()) {
        await redisClient!.set(ROLL_KEY(sessionId), JSON.stringify(payload), { EX: TTL_SECONDS });
    } else {
        memoryStore.set(sessionId, payload);
    }
};

export const getPendingRollRequest = async (
    sessionId: number
): Promise<StoredRollRequest | null> => {
    if (canUseRedis()) {
        const raw = await redisClient!.get(ROLL_KEY(sessionId));
        if (!raw) return null;
        try {
            return JSON.parse(raw) as StoredRollRequest;
        } catch (error) {
            console.error('[rollRequestService] Falha ao analisar roll pendente:', error);
            return null;
        }
    }
    return memoryStore.get(sessionId) ?? null;
};

export const clearPendingRollRequest = async (sessionId: number) => {
    let stored: StoredRollRequest | null = null;
    if (canUseRedis()) {
        const raw = await redisClient!.get(ROLL_KEY(sessionId));
        if (raw) {
            try {
                stored = JSON.parse(raw) as StoredRollRequest;
            } catch (error) {
                console.warn('[rollRequestService] Falha ao restaurar contexto do roll pendente antes de limpar.', error);
            }
        }
        await redisClient!.del(ROLL_KEY(sessionId));
    } else {
        stored = memoryStore.get(sessionId) ?? null;
        memoryStore.delete(sessionId);
    }
    const queueEntry = await dequeueRollQueueHead(sessionId, stored?.requestId);
    const actionForMetrics = stored?.context?.actionId ?? queueEntry?.actionId;
    if (actionForMetrics) {
        clearRollEmission(sessionId, actionForMetrics);
    }
};

export const clearAllPendingRollRequestsForUser = async (userId: number): Promise<number> => {
    const sessaoRepo = AppDataSource.getRepository(SessaoIA);
    const sessions = await sessaoRepo.find({
        where: { userId },
        select: ['id'],
    });
    if (!sessions.length) return 0;
    await Promise.all(
        sessions.map(({ id }) => clearPendingRollRequest(id))
    );
    return sessions.length;
};

export const __rollRequestTestHooks = {
    useMemoryOnly: () => {
        forceMemoryOnly = true;
        memoryStore.clear();
        memoryQueueStore.clear();
    },
    reset: () => {
        forceMemoryOnly = false;
        memoryStore.clear();
        memoryQueueStore.clear();
    },
    peekQueueHead: async (sessionId: number) => {
        const queue = await readQueue(sessionId);
        return queue[0] ?? null;
    },
};

export const getRollQueueSize = async (sessionId: number): Promise<number> => {
    const queue = await readQueue(sessionId);
    return queue.length;
};
