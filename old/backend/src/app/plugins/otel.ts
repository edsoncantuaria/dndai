import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'crypto';

/** Hook leve de trace — substituível por SDK OTel completo depois. */
export async function registerOtelHooks(app: FastifyInstance): Promise<void> {
    app.addHook('onRequest', async (request: FastifyRequest) => {
        const traceId = (request.headers['x-trace-id'] as string) || randomUUID();
        request.headers['x-trace-id'] = traceId;
    });

    app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
        const traceId = request.headers['x-trace-id'];
        if (traceId) reply.header('x-trace-id', traceId);
    });
}
