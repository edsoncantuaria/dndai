import { Request, Response, NextFunction } from 'express';
import { formatWarningMetrics } from '../services/warningMetricsService.js';
import { formatDeltaMetrics } from '../services/deltaMetricsService.js';
import { formatRollMetrics } from '../services/rollMetricsService.js';
import { formatActionMetrics } from '../services/actionObservabilityService.js';

export const getWarningMetrics = (_req: Request, res: Response, _next: NextFunction) => {
    const lines = [
        formatWarningMetrics(),
        formatDeltaMetrics(),
        formatRollMetrics(),
        formatActionMetrics(),
    ].filter(Boolean);
    res.type('text/plain').send(lines.join('\n') || '# no metrics yet');
};
