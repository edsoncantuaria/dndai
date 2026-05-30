import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import { isDevLanOrigin, parseAllowedOrigins } from '../../config/penaiEnv.js';

export async function registerCors(app: FastifyInstance): Promise<void> {
    const allowed = parseAllowedOrigins();
    await app.register(cors, {
        origin: (origin, cb) => {
            if (!origin) return cb(null, true);
            if (
                allowed.includes(origin) ||
                isDevLanOrigin(origin) ||
                origin.endsWith('.cloudworkstations.dev') ||
                origin.endsWith('.webcontainer-api.io')
            ) {
                return cb(null, true);
            }
            cb(new Error('Origem não permitida pelo CORS'), false);
        },
        methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    });
}
