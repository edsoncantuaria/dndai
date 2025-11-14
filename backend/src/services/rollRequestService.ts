// backend/src/services/rollRequestService.ts
import { PlayerRollRequest } from '../types.js';
import redisClient from '../database/redis-client.js';
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { recordRollEmission, clearRollEmission } from './rollMetricsService.js';

const ROLL_KEY = (sessionId: number) => `session:${sessionId}:pendingRoll`;
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

const canUseRedis = () => !!redisClient && redisClient.isOpen;

export const savePendingRollRequest = async (
    sessionId: number,
    userId: number,
    request: PlayerRollRequest & { requestId: string },
    context?: RollRequestContext
) => {
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
    recordRollEmission(sessionId, context?.actionId, context?.intentType);
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
    if (stored?.context?.actionId) {
        clearRollEmission(sessionId, stored.context.actionId);
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
