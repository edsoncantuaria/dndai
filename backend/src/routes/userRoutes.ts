// backend/src/routes/userRoutes.ts
import { Router } from 'express';
import { getMe, updateSettings, acknowledgeHomebrewDisclaimer, updateUserHomebrew, invalidateUserCache } from '../controllers/userController.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/me', authMiddleware, getMe);
router.put('/me/settings', authMiddleware, updateSettings);
router.post('/me/acknowledge-homebrew', authMiddleware, acknowledgeHomebrewDisclaimer);
router.patch('/me/homebrew', authMiddleware, updateUserHomebrew);

// Nova rota para invalidação de cache
router.post('/me/invalidate-cache', authMiddleware, async (req: any, res, next) => {
    const userId = req.user?.userId;
    if (!userId) {
        return next(new Error('Usuário não autenticado.'));
    }
    try {
        await invalidateUserCache(userId);
        res.status(204).send();
    } catch(error) {
        next(error);
    }
});


export default router;
