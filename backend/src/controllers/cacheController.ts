// backend/src/controllers/cacheController.ts
import type { Request, Response, NextFunction } from 'express';
import redisClient from '../database/redis-client.js';

export const clearAllCaches = async (_req: Request, res: Response, next: NextFunction) => {
    try {
        if (!redisClient) {
            return res.status(200).json({
                message: 'Redis não está configurado. Nenhum cache para limpar.',
            });
        }

        const infoBefore = await redisClient.dbSize().catch(() => 0);
        await redisClient.flushAll();

        return res.status(200).json({
            message: 'Todos os caches Redis foram limpos com sucesso.',
            keysBefore: infoBefore,
        });
    } catch (error) {
        next(error);
    }
};

