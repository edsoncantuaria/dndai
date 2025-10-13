// backend/src/routes/userRoutes.ts
import { Router } from 'express';
import { getMe, updateSettings } from '../controllers/userController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/me', authMiddleware, getMe);
router.put('/me/settings', authMiddleware, updateSettings);

export default router;
