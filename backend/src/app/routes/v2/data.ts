import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import createError from 'http-errors';
import { getUnifiedDetails, getUnifiedList } from '../../GameMaster/homebrew/penaiUnifiedDataService.js';

async function resolveDataUserId(app: FastifyInstance, request: FastifyRequest): Promise<number> {
    if (request.headers.authorization) {
        await app.authenticate(request);
        return request.userId;
    }
    return 0;
}

function sendErr(reply: FastifyReply, err: unknown) {
    if (createError.isHttpError(err)) {
        return reply.status(err.statusCode).send({ message: err.message });
    }
    throw err;
}

export async function dataRoutes(app: FastifyInstance): Promise<void> {
    app.get('/api/v2/data/:resource', async (request, reply) => {
        try {
            const userId = await resolveDataUserId(app, request);
            const { resource } = request.params as { resource: string };
            return await getUnifiedList(resource, userId);
        } catch (err) {
            return sendErr(reply, err);
        }
    });

    app.get('/api/v2/data/:resource/:index/:subindex?', async (request, reply) => {
        try {
            const userId = await resolveDataUserId(app, request);
            const { resource, index, subindex } = request.params as {
                resource: string;
                index: string;
                subindex?: string;
            };
            const fullResourcePath = subindex ? `${resource}/${index}` : resource;
            const finalIndex = subindex || index;
            const data = await getUnifiedDetails(fullResourcePath, finalIndex, userId);
            if (!data || (Array.isArray(data) && data.length === 0)) {
                return reply.status(404).send({ message: 'Recurso não encontrado.' });
            }
            return data;
        } catch (err) {
            return sendErr(reply, err);
        }
    });
}
