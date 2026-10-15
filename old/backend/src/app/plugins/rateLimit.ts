import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';

export async function registerRateLimit(app: FastifyInstance): Promise<void> {
    await app.register(rateLimit, {
        max: 200,
        timeWindow: '1 minute',
        keyGenerator: req => {
            const userId = (req.user as { id?: number } | undefined)?.id;
            return userId ? `user:${userId}` : req.ip;
        },
        errorResponseBuilder: () => ({
            statusCode: 429,
            error: 'Muitas requisições',
            message: 'Limite de taxa excedido. Tente novamente em instantes.',
        }),
    });
}
