import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { getGameEventsByAction } from '../controllers/adminEventsController.js';

const router = Router();

router.use(authMiddleware);
router.get('/sessions/:sessionId/actions/:actionId/events', getGameEventsByAction);

export default router;
