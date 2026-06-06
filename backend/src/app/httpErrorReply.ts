import type { FastifyReply } from 'fastify';
import { isHttpError } from '../utils/httpErrors.js';

export function sendHttpError(reply: FastifyReply, err: unknown): FastifyReply | never {
    if (isHttpError(err)) {
        const body: Record<string, unknown> = { message: err.message, error: err.message };
        if ('errors' in err && err.errors) {
            body.errors = err.errors;
        }
        const status = err.statusCode ?? err.status ?? 500;
        return reply.status(status).send(body);
    }
    throw err;
}
