export type KeyMetricSnapshot = {
    keyId: string;
    totalRequests: number;
    successes: number;
    failures: number;
    rateLimits: number;
    avgLatencyMs: number;
    lastUsedAt: string | null;
    cooldownUntil: string | null;
    healthScore: number;
    /** RPM no minuto UTC atual (Redis, se disponível). */
    currentMinuteRpm?: number;
    currentMinuteOk?: number;
    /** TPM estimado (tokens ≈ chars/4) no minuto atual. */
    estimatedTokensMinute?: number;
    promptTokensTotal?: number;
    completionTokensTotal?: number;
};

export type GlobalMetricSnapshot = {
    totalRequests: number;
    jsonRepairAttempts: number;
    jsonRepairSuccesses: number;
    localFieldRepairs: number;
    jsonRepairRate: number | null;
    recordedAt: string;
    keys: KeyMetricSnapshot[];
};

const globalCounters = {
    jsonRepairAttempts: 0,
    jsonRepairSuccesses: 0,
    localFieldRepairs: 0,
    ossGenerationAttempts: 0,
    ossFirstPassJsonOk: 0,
};

export function recordOssGenerationAttempt(firstPassOk: boolean): void {
    globalCounters.ossGenerationAttempts += 1;
    if (firstPassOk) globalCounters.ossFirstPassJsonOk += 1;
}

export function getOssGenerationCounters(): {
    attempts: number;
    firstPassOk: number;
} {
    return {
        attempts: globalCounters.ossGenerationAttempts,
        firstPassOk: globalCounters.ossFirstPassJsonOk,
    };
}

export function resetOssMetricsForTests(): void {
    globalCounters.jsonRepairAttempts = 0;
    globalCounters.jsonRepairSuccesses = 0;
    globalCounters.localFieldRepairs = 0;
    globalCounters.ossGenerationAttempts = 0;
    globalCounters.ossFirstPassJsonOk = 0;
}

export function recordJsonRepairAttempt(success: boolean): void {
    globalCounters.jsonRepairAttempts += 1;
    if (success) globalCounters.jsonRepairSuccesses += 1;
}

export function recordLocalRepairSuccess(): void {
    globalCounters.localFieldRepairs += 1;
    globalCounters.jsonRepairSuccesses += 1;
}

export function buildGlobalSnapshot(keyRows: KeyMetricSnapshot[]): GlobalMetricSnapshot {
    return {
        totalRequests: keyRows.reduce((s, k) => s + k.totalRequests, 0),
        jsonRepairAttempts: globalCounters.jsonRepairAttempts,
        jsonRepairSuccesses: globalCounters.jsonRepairSuccesses,
        localFieldRepairs: globalCounters.localFieldRepairs,
        jsonRepairRate:
            globalCounters.jsonRepairAttempts > 0
                ? globalCounters.jsonRepairSuccesses / globalCounters.jsonRepairAttempts
                : null,
        recordedAt: new Date().toISOString(),
        keys: keyRows,
    };
}
