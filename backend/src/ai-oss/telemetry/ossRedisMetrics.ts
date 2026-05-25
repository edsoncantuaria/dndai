import redisClient, { ensureRedisConnection } from '../../database/redis-client.js';
import type { GlobalMetricSnapshot } from './requestMetrics.js';
import type { KeyMetricSnapshot } from './requestMetrics.js';

const METRICS_KEY = 'oss:metrics:latest';
const RPM_PREFIX = 'oss:rpm:';
const TPM_PREFIX = 'oss:tpm:';
const TTL_SECONDS = 86400;

/** Estimativa OpenRouter free: ~4 chars por token. */
export function estimateTokensFromChars(chars: number): number {
    return Math.max(0, Math.ceil(chars / 4));
}

function minuteBucket(): string {
    const d = new Date();
    return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export async function recordOssRequestInRedis(
    keyId: string,
    ok: boolean,
    tokenEstimate = 0,
): Promise<void> {
    if (!redisClient) return;
    try {
        await ensureRedisConnection();
        if (!redisClient?.isOpen) return;
        const bucket = minuteBucket();
        const rpmKey = `${RPM_PREFIX}${keyId}:${bucket}`;
        await redisClient.incr(rpmKey);
        await redisClient.expire(rpmKey, 120);
        const statusKey = `${rpmKey}:ok`;
        if (ok) await redisClient.incr(statusKey);
        await redisClient.expire(statusKey, 120);
        if (tokenEstimate > 0) {
            const tpmKey = `${TPM_PREFIX}${keyId}:${bucket}`;
            await redisClient.incrBy(tpmKey, tokenEstimate);
            await redisClient.expire(tpmKey, 120);
        }
    } catch (err) {
        console.warn('[ossRedisMetrics] Falha ao registrar RPM:', err);
    }
}

export async function persistOssMetricsSnapshot(snapshot: GlobalMetricSnapshot): Promise<void> {
    if (!redisClient) return;
    try {
        await ensureRedisConnection();
        if (!redisClient?.isOpen) return;
        await redisClient.set(METRICS_KEY, JSON.stringify(snapshot), { EX: TTL_SECONDS });
    } catch (err) {
        console.warn('[ossRedisMetrics] Falha ao persistir snapshot:', err);
    }
}

export async function loadOssMetricsSnapshot(): Promise<GlobalMetricSnapshot | null> {
    if (!redisClient) return null;
    try {
        await ensureRedisConnection();
        if (!redisClient?.isOpen) return null;
        const raw = await redisClient.get(METRICS_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as GlobalMetricSnapshot;
    } catch {
        return null;
    }
}

/** RPM por key no minuto atual (Redis). */
export async function loadCurrentRpmByKey(keyId: string): Promise<{ total: number; ok: number }> {
    if (!redisClient) return { total: 0, ok: 0 };
    try {
        await ensureRedisConnection();
        if (!redisClient?.isOpen) return { total: 0, ok: 0 };
        const bucket = minuteBucket();
        const rpmKey = `${RPM_PREFIX}${keyId}:${bucket}`;
        const total = Number(await redisClient.get(rpmKey)) || 0;
        const ok = Number(await redisClient.get(`${rpmKey}:ok`)) || 0;
        return { total, ok };
    } catch {
        return { total: 0, ok: 0 };
    }
}

export async function loadCurrentTpmByKey(keyId: string): Promise<number> {
    if (!redisClient) return 0;
    try {
        await ensureRedisConnection();
        if (!redisClient?.isOpen) return 0;
        const bucket = minuteBucket();
        const tpmKey = `${TPM_PREFIX}${keyId}:${bucket}`;
        return Number(await redisClient.get(tpmKey)) || 0;
    } catch {
        return 0;
    }
}

export async function enrichKeysWithRedisRpm(keys: KeyMetricSnapshot[]): Promise<KeyMetricSnapshot[]> {
    const enriched = await Promise.all(
        keys.map(async key => {
            const rpm = await loadCurrentRpmByKey(key.keyId);
            const tpm = await loadCurrentTpmByKey(key.keyId);
            return {
                ...key,
                currentMinuteRpm: rpm.total,
                currentMinuteOk: rpm.ok,
                estimatedTokensMinute: tpm,
            };
        }),
    );
    return enriched;
}

export async function loadTpmByKeyMap(keyIds: string[]): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    await Promise.all(
        keyIds.map(async id => {
            out[id] = await loadCurrentTpmByKey(id);
        }),
    );
    return out;
}
