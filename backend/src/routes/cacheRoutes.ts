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

const FLUSH_INTERVAL_MS = 60_000;
let lastFlushAt = 0;

const rateLimitFlush = (_req: AuthRequest, _res: any, next: any) => {
    const now = Date.now();
    if (lastFlushAt && now - lastFlushAt < FLUSH_INTERVAL_MS) {
        const seconds = Math.ceil((FLUSH_INTERVAL_MS - (now - lastFlushAt)) / 1000);
        return next(createError(429, `Aguarde ${seconds}s antes de limpar os caches novamente.`));
    }
    next();
};

router.use(authMiddleware, requireAdmin);

router.post('/flush', rateLimitFlush, async (req, res, next) => {
    try {
        await clearAllCaches(req, res, next);
        if (res.locals.cacheFlushed) {
            lastFlushAt = Date.now();
        }
    } catch (error) {
        next(error);
    }
});

export default router;
