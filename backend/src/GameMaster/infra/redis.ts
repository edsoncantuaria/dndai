import { createClient, type RedisClientType } from 'redis';
import { penaiEnv } from '../../config/penaiEnv.js';

let client: RedisClientType | null = null;
const MOCK = penaiEnv.REDIS_URL === 'mock';

export async function initRedis(): Promise<void> {
    if (MOCK) {
        console.log('[PENAI] Redis mock — pub/sub desativado.');
        return;
    }
    client = createClient({ url: penaiEnv.REDIS_URL });
    client.on('error', err => console.error('[PENAI][Redis]', err));
    await client.connect();
    console.log('[PENAI] Redis conectado.');
}

export function getRedis(): RedisClientType | null {
    return client;
}

export async function checkRedisHealth(): Promise<{ ok: boolean; message: string }> {
    if (MOCK) return { ok: true, message: 'mock' };
    if (!client?.isOpen) return { ok: false, message: 'desconectado' };
    try {
        await client.ping();
        return { ok: true, message: 'Redis OK' };
    } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : 'erro' };
    }
}

export const WS_PUBSUB_CHANNEL = 'penai:ws:user';
