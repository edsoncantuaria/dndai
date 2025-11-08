// backend/src/routes/cacheRoutes.ts
import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middlewares/authMiddleware.js';
import createError from 'http-errors';
import { clearAllCaches } from '../controllers/cacheController.js';

const router = Router();

const requireAdmin = (req: AuthRequest, _res: any, next: any) => {
    if (req.user?.userId !== 1) {
        return next(createError(403, 'Apenas administradores podem limpar o cache.'));
    }
    next();
};

router.use(authMiddleware, requireAdmin);

router.post('/flush', clearAllCaches);

export default router;
