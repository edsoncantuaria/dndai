import type { FastifyRequest } from 'fastify';
import createError from 'http-errors';

export type JwtPayload = { userId: number };

declare module 'fastify' {
    interface FastifyRequest {
        userId: number;
    }
}

export function resolveRequestUserId(request: FastifyRequest): number {
    const payload = request.user as JwtPayload | undefined;
    const userId = payload?.userId;
    if (!userId || !Number.isFinite(userId)) {
        throw createError(401, 'Não autorizado.');
    }
    return userId;
}

export async function attachUserId(request: FastifyRequest): Promise<void> {
    request.userId = resolveRequestUserId(request);
}
