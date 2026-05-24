import redisClient, { ensureRedisConnection } from '../database/redis-client.js';
import type { JsonRepairStrategy } from './responseParser.js';

export interface AiPipelineMetricSample {
    sessionId?: string;
    phase: 'narrative' | 'state' | 'full';
    model: string;
    latencyMs: number;
    promptTokens?: number;
    outputTokens?: number;
    repairStrategy?: JsonRepairStrategy | string;
    retryCount?: number;
    usedFallback?: boolean;
    success: boolean;
}

const FALLBACK_SAMPLES: AiPipelineMetricSample[] = [];
const MAX_FALLBACK = 200;

const todayKey = () => new Date().toISOString().slice(0, 10);
const redisKey = (date: string) => `aiPipeline:${date}`;

type DailyAggregate = {
    samples: number;
    success: number;
    fallback: number;
    repairs: Record<string, number>;
    totalLatencyMs: number;
};

const emptyAggregate = (): DailyAggregate => ({
    samples: 0,
    success: 0,
    fallback: 0,
    repairs: {},
    totalLatencyMs: 0,
});

export async function recordAiPipelineMetric(sample: AiPipelineMetricSample): Promise<void> {
    FALLBACK_SAMPLES.push(sample);
    if (FALLBACK_SAMPLES.length > MAX_FALLBACK) {
        FALLBACK_SAMPLES.shift();
    }

    if (!redisClient) return;
    try {
        await ensureRedisConnection();
        const key = redisKey(todayKey());
        const raw = await redisClient.get(key);
        const agg: DailyAggregate = raw ? JSON.parse(raw) : emptyAggregate();
        agg.samples += 1;
        if (sample.success) agg.success += 1;
        if (sample.usedFallback) agg.fallback += 1;
        agg.totalLatencyMs += sample.latencyMs;
        if (sample.repairStrategy) {
            const label = String(sample.repairStrategy);
            agg.repairs[label] = (agg.repairs[label] ?? 0) + 1;
        }
        await redisClient.set(key, JSON.stringify(agg), { EX: 86400 * 14 });
    } catch (err) {
        console.warn('[ai/metrics] Falha ao registrar métrica:', err);
    }
}

export async function getAiPipelineMetrics(date?: string): Promise<DailyAggregate & { avgLatencyMs: number }> {
    const target = date ?? todayKey();
    if (redisClient) {
        try {
            await ensureRedisConnection();
            const raw = await redisClient.get(redisKey(target));
            if (raw) {
                const agg = JSON.parse(raw) as DailyAggregate;
                return {
                    ...agg,
                    avgLatencyMs: agg.samples ? Math.round(agg.totalLatencyMs / agg.samples) : 0,
                };
            }
        } catch {
            /* fallback below */
        }
    }
    const today = FALLBACK_SAMPLES.filter(s => true);
    const agg = today.reduce((acc, s) => {
        acc.samples += 1;
        if (s.success) acc.success += 1;
        if (s.usedFallback) acc.fallback += 1;
        acc.totalLatencyMs += s.latencyMs;
        if (s.repairStrategy) {
            const label = String(s.repairStrategy);
            acc.repairs[label] = (acc.repairs[label] ?? 0) + 1;
        }
        return acc;
    }, emptyAggregate());
    return {
        ...agg,
        avgLatencyMs: agg.samples ? Math.round(agg.totalLatencyMs / agg.samples) : 0,
    };
}
