import { Request, Response, NextFunction } from 'express';
import { formatWarningMetrics } from '../services/warningMetricsService.js';

export const getWarningMetrics = (_req: Request, res: Response, _next: NextFunction) => {
    const payload = formatWarningMetrics();
    res.type('text/plain').send(payload || '# no metrics yet');
};

