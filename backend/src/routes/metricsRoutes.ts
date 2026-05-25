import { Router } from 'express';
import {
    getWarningMetrics,
    getAiPipelineMetricsHandler,
    getOpenRouterMetricsHandler,
} from '../controllers/metricsController.js';

const router = Router();

router.get('/warnings', getWarningMetrics);
router.get('/ai-pipeline', getAiPipelineMetricsHandler);
router.get('/openrouter', getOpenRouterMetricsHandler);

export default router;

