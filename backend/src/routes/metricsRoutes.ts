import { Router } from 'express';
import { getWarningMetrics } from '../controllers/metricsController.js';

const router = Router();

router.get('/warnings', getWarningMetrics);

export default router;

