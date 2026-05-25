const MAX_SAMPLES = 500;

const globalLatencies: number[] = [];
const perKeyLatencies = new Map<string, number[]>();

function pushSample(bucket: number[], ms: number): void {
    bucket.push(ms);
    if (bucket.length > MAX_SAMPLES) {
        bucket.splice(0, bucket.length - MAX_SAMPLES);
    }
}

function percentile(sorted: number[], p: number): number {
    if (!sorted.length) return 0;
    const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
    return sorted[Math.max(0, idx)] ?? 0;
}

export function recordOssLatency(keyId: string | null, latencyMs: number): void {
    if (!Number.isFinite(latencyMs) || latencyMs < 0) return;
    pushSample(globalLatencies, latencyMs);
    if (keyId) {
        const bucket = perKeyLatencies.get(keyId) ?? [];
        pushSample(bucket, latencyMs);
        perKeyLatencies.set(keyId, bucket);
    }
}

export function computeLatencyPercentiles(samples: number[]): {
    p50: number;
    p95: number;
    count: number;
} {
    if (!samples.length) return { p50: 0, p95: 0, count: 0 };
    const sorted = [...samples].sort((a, b) => a - b);
    return {
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        count: sorted.length,
    };
}

export function getGlobalLatencyStats(): { p50: number; p95: number; count: number } {
    return computeLatencyPercentiles(globalLatencies);
}

export function getKeyLatencyStats(keyId: string): { p50: number; p95: number; count: number } {
    return computeLatencyPercentiles(perKeyLatencies.get(keyId) ?? []);
}

export function resetLatencyTrackerForTests(): void {
    globalLatencies.length = 0;
    perKeyLatencies.clear();
}
