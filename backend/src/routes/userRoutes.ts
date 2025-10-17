// backend/src/routes/userRoutes.ts
import { Router } from 'express';
import { getMe, updateSettings, acknowledgeHomebrewDisclaimer, updateUserHomebrew } from '../controllers/userController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/me', authMiddleware, getMe);
router.put('/me/settings', authMiddleware, updateSettings);
router.post('/me/acknowledge-homebrew', authMiddleware, acknowledgeHomebrewDisclaimer);
router.patch('/me/homebrew', authMiddleware, updateUserHomebrew);

export default router;
