import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { processActionRest } from '../controllers/actionController.js';

const router = Router();

router.post('/:sessionId/actions', authMiddleware, processActionRest);

export default router;
