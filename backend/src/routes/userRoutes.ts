// backend/src/routes/userRoutes.ts
import { Router } from 'express';
import { getMe } from '../controllers/userController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/me', authMiddleware, getMe);

export default router;
