import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { clearPendingRollsForUser } from '../controllers/rollRequestController.js';

const router = Router();

router.post('/clear', authMiddleware, clearPendingRollsForUser);

export default router;
