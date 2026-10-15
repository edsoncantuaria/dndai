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

const JSON_REPAIR_ALERT_THRESHOLD = Number(process.env.JSON_REPAIR_ALERT_THRESHOLD ?? 0.15);

export function getPipelineLatencySnapshot(): Record<string, unknown> {
    const avg = (arr: number[]) =>
        arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
    const totalRepairs = buckets.json_repair.ok + buckets.json_repair.fail;
    const jsonRepairSuccessRate = totalRepairs > 0 ? buckets.json_repair.ok / totalRepairs : null;
    const jsonRepairFailureRate = totalRepairs > 0 ? buckets.json_repair.fail / totalRepairs : null;
    return {
        mechanical_latency_ms_avg: avg(buckets.mechanical_ms),
        narration_latency_ms_avg: avg(buckets.narration_ms),
        json_repair_rate: jsonRepairSuccessRate,
        json_repair_failure_rate: jsonRepairFailureRate,
        json_repair_alert:
            jsonRepairFailureRate != null && Number.isFinite(JSON_REPAIR_ALERT_THRESHOLD)
                ? jsonRepairFailureRate > JSON_REPAIR_ALERT_THRESHOLD
                : false,
        json_repair_alert_threshold: JSON_REPAIR_ALERT_THRESHOLD,
        samples: {
            mechanical: buckets.mechanical_ms.length,
            narration: buckets.narration_ms.length,
            json_repair: totalRepairs,
        },
    };
}
