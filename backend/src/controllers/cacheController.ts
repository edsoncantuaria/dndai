// backend/src/controllers/cacheController.ts
import type { Response, NextFunction } from 'express';
import redisClient from '../database/redis-client.js';
import type { AuthRequest } from '../middlewares/authMiddleware.js';

export const clearAllCaches = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!redisClient) {
            return res.status(200).json({
                message: 'Redis não está configurado. Nenhum cache para limpar.',
            });
        }

        const infoBefore = await redisClient.dbSize().catch(() => 0);
        await redisClient.flushAll();

        console.warn(`[CacheController] Flush de cache solicitado pelo usuário ${req.user?.userId}. Chaves antes: ${infoBefore}.`);
        res.locals.cacheFlushed = true;

        return res.status(200).json({
            message: 'Todos os caches Redis foram limpos com sucesso.',
            keysBefore: infoBefore,
        });
    } catch (error) {
        next(error);
    }
};
