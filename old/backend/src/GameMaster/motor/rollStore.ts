import { randomUUID } from 'crypto';
import type { PlayerRollRequest } from '../../types.js';
import { resolveRedisUrl } from '../../config/redisUrl.js';

export type StoredPenaiRoll = PlayerRollRequest & {
    requestId: string;
    sessionId: number;
    userId: number;
    actionId: string;
    actionSequence: number;
    playerAction: string;
    createdAt: number;
};

const memoryStore = new Map<number, StoredPenaiRoll>();

function redisKey(sessionId: number): string {
    return `penai:roll:${sessionId}`;
}

async function getRedis(): Promise<import('ioredis').default | null> {
    const url = resolveRedisUrl();
    if (!url || url === 'mock') return null;
    try {
        const { default: Redis } = await import('ioredis');
        return new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
    } catch {
        return null;
    }
}

export async function savePendingPenaiRoll(opts: {
    sessionId: number;
    userId: number;
    actionId: string;
    actionSequence: number;
    playerAction: string;
    roll: PlayerRollRequest;
}): Promise<StoredPenaiRoll> {
    const requestId = opts.roll.requestId ?? randomUUID();
    const stored: StoredPenaiRoll = {
        ...opts.roll,
        requestId,
        sessionId: opts.sessionId,
        userId: opts.userId,
        actionId: opts.actionId,
        actionSequence: opts.actionSequence,
        playerAction: opts.playerAction,
        createdAt: Date.now(),
    };

    const redis = await getRedis();
    if (redis) {
        try {
            await redis.connect().catch(() => undefined);
            await redis.set(redisKey(opts.sessionId), JSON.stringify(stored), 'EX', 3600);
            redis.disconnect();
        } catch {
            memoryStore.set(opts.sessionId, stored);
        }
    } else {
        memoryStore.set(opts.sessionId, stored);
    }
    return stored;
}

export async function getPendingPenaiRoll(sessionId: number): Promise<StoredPenaiRoll | null> {
    const redis = await getRedis();
    if (redis) {
        try {
            await redis.connect().catch(() => undefined);
            const raw = await redis.get(redisKey(sessionId));
            redis.disconnect();
            if (raw) return JSON.parse(raw) as StoredPenaiRoll;
        } catch {
            /* fallback memory */
        }
    }
    return memoryStore.get(sessionId) ?? null;
}

export async function clearPendingPenaiRoll(sessionId: number): Promise<void> {
    memoryStore.delete(sessionId);
    const redis = await getRedis();
    if (redis) {
        try {
            await redis.connect().catch(() => undefined);
            await redis.del(redisKey(sessionId));
            redis.disconnect();
        } catch {
            /* ignore */
        }
    }
}

export async function hasPendingPenaiRoll(sessionId: number): Promise<boolean> {
    return Boolean(await getPendingPenaiRoll(sessionId));
}
