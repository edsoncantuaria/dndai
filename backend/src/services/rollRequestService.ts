// backend/src/services/rollRequestService.ts
import { PlayerRollRequest } from '../types.js';
import redisClient from '../database/redis-client.js';

const ROLL_KEY = (sessionId: number) => `session:${sessionId}:pendingRoll`;
const TTL_SECONDS = 60 * 15; // 15 minutes

type StoredRollRequest = PlayerRollRequest & {
    requestId: string;
    sessionId: number;
    userId: number;
    createdAt: number;
};

const memoryStore = new Map<number, StoredRollRequest>();

const canUseRedis = () => !!redisClient && redisClient.isOpen;

export const savePendingRollRequest = async (
    sessionId: number,
    userId: number,
    request: PlayerRollRequest & { requestId: string }
) => {
    const payload: StoredRollRequest = {
        ...request,
        sessionId,
        userId,
        createdAt: Date.now(),
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
    if (canUseRedis()) {
        await redisClient!.del(ROLL_KEY(sessionId));
    }
    memoryStore.delete(sessionId);
};
