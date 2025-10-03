
import { Router } from 'express';
import * as userController from '../controllers/userController';
import { authenticateToken } from '../middlewares/authMiddleware';

const router = Router();

router.get('/me', authenticateToken, userController.getCurrentUser);
router.get('/:id', userController.getUserById);

export default router;
