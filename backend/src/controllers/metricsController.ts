import { Request, Response, NextFunction } from 'express';
import { formatWarningMetrics } from '../services/warningMetricsService.js';
import { formatDeltaMetrics } from '../services/deltaMetricsService.js';
import { formatRollMetrics } from '../services/rollMetricsService.js';
import { formatActionMetrics } from '../services/actionObservabilityService.js';
import { getAiPipelineMetrics } from '../ai/metrics.js';
import { getOpenRouterManager } from '../ai-oss/providers/OpenRouterManager.js';
import { buildGlobalSnapshot } from '../ai-oss/telemetry/requestMetrics.js';
import {
    enrichKeysWithRedisRpm,
    loadOssMetricsSnapshot,
    loadTpmByKeyMap,
    persistOssMetricsSnapshot,
} from '../ai-oss/telemetry/ossRedisMetrics.js';
import { enrichObservabilitySnapshot } from '../ai-oss/telemetry/ossObservability.js';
import { getOssGenerationCounters } from '../ai-oss/telemetry/requestMetrics.js';
import { getPipelineLatencySnapshot } from '../telemetry/pipelineLatency.js';

export const getWarningMetrics = (_req: Request, res: Response, _next: NextFunction) => {
    const lines = [
        formatWarningMetrics(),
        formatDeltaMetrics(),
        formatRollMetrics(),
        formatActionMetrics(),
    ].filter(Boolean);
    res.type('text/plain').send(lines.join('\n') || '# no metrics yet');
};

export const getAiPipelineMetricsHandler = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const metrics = await getAiPipelineMetrics();
        res.status(200).json(metrics);
    } catch (error) {
        next(error);
    }
};

/** Métricas do pool OpenRouter (keys, RPM implícito, health). Dev/observabilidade. */
export const getOpenRouterMetricsHandler = async (_req: Request, res: Response) => {
    const manager = getOpenRouterManager();
    const keys = await enrichKeysWithRedisRpm(manager.getMetricsSnapshot());
    const base = buildGlobalSnapshot(keys);
    const gen = getOssGenerationCounters();
    const tpmMap = await loadTpmByKeyMap(keys.map(k => k.keyId));
    const snapshot = enrichObservabilitySnapshot(base, {
        ossAttempts: gen.attempts,
        ossFirstPassOk: gen.firstPassOk,
        keyTpm: tpmMap,
    });
    void persistOssMetricsSnapshot(snapshot);
    const cached = await loadOssMetricsSnapshot();
    res.status(200).json({
        ...snapshot,
        cachedAt: cached?.recordedAt ?? null,
        poolSize: manager.size,
        preferServerKeys: process.env.OPENROUTER_PREFER_SERVER_KEYS ?? 'true',
        defaultModel: process.env.AI_DEFAULT_MODEL ?? 'openai/gpt-oss-120b:free',
        aiEngine: process.env.AI_ENGINE ?? 'legacy',
        ossStreamEnabled: ['1', 'true', 'yes', 'on'].includes(
            (process.env.OSS_STREAM_NARRATION ?? 'false').trim().toLowerCase(),
        ),
        pipeline: getPipelineLatencySnapshot(),
    });
};
