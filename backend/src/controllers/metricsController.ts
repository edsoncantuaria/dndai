import { Request, Response, NextFunction } from 'express';
import { formatWarningMetrics } from '../services/warningMetricsService.js';
import { formatDeltaMetrics } from '../services/deltaMetricsService.js';
import { formatRollMetrics } from '../services/rollMetricsService.js';
import { formatActionMetrics } from '../services/actionObservabilityService.js';
import { getAiPipelineMetrics } from '../ai/metrics.js';

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
