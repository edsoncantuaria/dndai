// backend/src/routes/userRoutes.ts
import { Router } from 'express';
import { getMe, updateSettings, acknowledgeHomebrewDisclaimer } from '../controllers/userController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/me', authMiddleware, getMe);
router.put('/me/settings', authMiddleware, updateSettings);
router.post('/me/acknowledge-homebrew', authMiddleware, acknowledgeHomebrewDisclaimer);

export default router;
