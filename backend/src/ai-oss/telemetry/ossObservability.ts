import type { GlobalMetricSnapshot } from './requestMetrics.js';
import { getGlobalLatencyStats, getKeyLatencyStats } from './latencyTracker.js';

export type OssObservabilitySnapshot = GlobalMetricSnapshot & {
    latencyMsGlobal: { p50: number; p95: number; count: number };
    jsonFailureRate: number | null;
    firstPassJsonRate: number | null;
    estimatedCostUsd: number;
    keys: Array<
        GlobalMetricSnapshot['keys'][number] & {
            latencyP50Ms?: number;
            latencyP95Ms?: number;
            estimatedTpmMinute?: number;
        }
    >;
};

export function enrichObservabilitySnapshot(
    base: GlobalMetricSnapshot,
    opts: {
        ossAttempts?: number;
        ossFirstPassOk?: number;
        keyTpm?: Record<string, number>;
    } = {},
): OssObservabilitySnapshot {
    const globalLatency = getGlobalLatencyStats();
    const attempts = opts.ossAttempts ?? 0;
    const firstPass = opts.ossFirstPassOk ?? 0;
    const jsonFailureRate =
        attempts > 0 ? Math.round(((attempts - firstPass) / attempts) * 1000) / 1000 : null;
    const firstPassJsonRate =
        attempts > 0 ? Math.round((firstPass / attempts) * 1000) / 1000 : null;

    const keys = base.keys.map(k => {
        const lat = getKeyLatencyStats(k.keyId);
        return {
            ...k,
            latencyP50Ms: lat.count ? lat.p50 : undefined,
            latencyP95Ms: lat.count ? lat.p95 : undefined,
            estimatedTpmMinute: opts.keyTpm?.[k.keyId],
            estimatedTokensMinute: k.estimatedTokensMinute,
        };
    });

    const totalTokensMinute = keys.reduce((s, k) => s + (k.estimatedTokensMinute ?? 0), 0);

    return {
        ...base,
        latencyMsGlobal: globalLatency,
        jsonFailureRate,
        firstPassJsonRate,
        estimatedCostUsd: Math.round(totalTokensMinute * 0 * 1e6) / 1e6,
        keys,
    };
}
