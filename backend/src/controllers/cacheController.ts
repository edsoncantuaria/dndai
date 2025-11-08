// backend/src/controllers/cacheController.ts
import type { Response, NextFunction } from 'express';
import redisClient from '../database/redis-client.js';
import type { AuthRequest } from '../middlewares/authMiddleware.js';

const CACHE_PATTERNS = [
    'character:*',
    'character:*:optimized',
    'session:*',
    'dnd5e:v2014:*',
    'user:*',
];

const deleteKeysByPattern = async (pattern: string) => {
    if (!redisClient || !redisClient.isOpen) return 0;
    let cursor = '0';
    let removed = 0;
    do {
        const scanResult: { cursor: string; keys: string[] } = await (redisClient as any).scan(cursor, {
            MATCH: pattern,
            COUNT: 200,
        });
        cursor = scanResult.cursor;
        if (scanResult.keys.length) {
            for (const key of scanResult.keys) {
                await redisClient.del(key);
            }
            removed += scanResult.keys.length;
        }
    } while (cursor !== '0');
    return removed;
};

export const clearAllCaches = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!redisClient) {
            return res.status(200).json({
                message: 'Redis não está configurado. Nenhum cache para limpar.',
            });
        }

        let totalDeleted = 0;
        for (const pattern of CACHE_PATTERNS) {
            totalDeleted += await deleteKeysByPattern(pattern);
        }

        console.warn(`[CacheController] Limpeza seletiva solicitada pelo usuário ${req.user?.userId}. Chaves removidas: ${totalDeleted}.`);
        res.locals.cacheFlushed = true;

        return res.status(200).json({
            message: 'Regiões de cache conhecidas foram limpas com sucesso.',
            keysRemoved: totalDeleted,
        });
    } catch (error) {
        next(error);
    }
};
