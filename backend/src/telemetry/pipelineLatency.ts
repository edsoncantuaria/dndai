/**
 * P1.3 — histogramas leves em memória (exportados via /api/admin/ai-metrics futuro).
 */
const buckets = {
    mechanical_ms: [] as number[],
    narration_ms: [] as number[],
    json_repair: { ok: 0, fail: 0 },
};

const MAX_SAMPLES = 200;

function pushSample(key: 'mechanical_ms' | 'narration_ms', ms: number): void {
    const arr = buckets[key];
    arr.push(ms);
    if (arr.length > MAX_SAMPLES) arr.shift();
}

export function recordMechanicalLatencyMs(ms: number): void {
    if (Number.isFinite(ms) && ms >= 0) pushSample('mechanical_ms', ms);
}

export function recordNarrationLatencyMs(ms: number): void {
    if (Number.isFinite(ms) && ms >= 0) pushSample('narration_ms', ms);
}

export function recordJsonRepairOutcome(success: boolean): void {
    if (success) buckets.json_repair.ok += 1;
    else buckets.json_repair.fail += 1;
}

export function getPipelineLatencySnapshot(): Record<string, unknown> {
    const avg = (arr: number[]) =>
        arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
    const totalRepairs = buckets.json_repair.ok + buckets.json_repair.fail;
    return {
        mechanical_latency_ms_avg: avg(buckets.mechanical_ms),
        narration_latency_ms_avg: avg(buckets.narration_ms),
        json_repair_rate:
            totalRepairs > 0 ? buckets.json_repair.ok / totalRepairs : null,
        samples: {
            mechanical: buckets.mechanical_ms.length,
            narration: buckets.narration_ms.length,
        },
    };
}
