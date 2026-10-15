import jwt from '@fastify/jwt';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { penaiEnv } from '../../config/penaiEnv.js';
import { attachUserId } from './requestUser.js';

export type JwtUser = { userId: number; email?: string };

declare module 'fastify' {
    interface FastifyInstance {
        authenticate: (request: FastifyRequest) => Promise<void>;
    }
}

export async function registerAuth(app: FastifyInstance): Promise<void> {
    await app.register(jwt, { secret: penaiEnv.JWT_SECRET });

    app.decorate('authenticate', async (request: FastifyRequest) => {
        await request.jwtVerify();
        await attachUserId(request);
    });
}

export function verifyWsToken(app: FastifyInstance, token: string): number | null {
    try {
        const decoded = app.jwt.verify<{ userId: number }>(token);
        return decoded.userId;
    } catch {
        return null;
    }
}
