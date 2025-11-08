// backend/src/routes/logsRoutes.ts
import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { getSessionLogs } from '../controllers/logsController.js';

const router = Router();

router.use(authMiddleware);
router.get('/:sessionId', getSessionLogs);

export default router;
