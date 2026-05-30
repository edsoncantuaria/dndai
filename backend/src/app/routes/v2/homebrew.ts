import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import createError from 'http-errors';
import {
    CreateHomebrewSchema,
    CreateBundleSchema,
    UpdateBundleSchema,
    CreateFromSrdSchema,
    ImportBundleSchema,
} from '../../../schemas/validationSchemas.js';
import * as HomebrewService from '../../../GameMaster/homebrew/homebrewService.js';
import * as SrdApi from '../../../services/srdApiAdapter.js';
import { HOMEBREW_TYPE_TO_SRD_RESOURCE } from '../../../types/homebrewSource.js';
import type { PenaiHomebrewContentType } from '../../../GameMaster/database/entities/HomebrewContent.js';

function sendErr(reply: FastifyReply, err: unknown) {
    if (createError.isHttpError(err)) {
        return reply.status(err.statusCode).send({ message: err.message, error: err.message });
    }
    throw err;
}

function optionalAuth(app: FastifyInstance) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        if (request.headers.authorization) {
            await app.authenticate(request);
        }
    };
}

export async function homebrewRoutes(app: FastifyInstance): Promise<void> {
    const auth = { preHandler: [app.authenticate] };

    app.post('/api/v2/homebrew/bundles', auth, async (request, reply) => {
        try {
            const data = CreateBundleSchema.parse(request.body);
            const bundle = await HomebrewService.createBundle(request.userId, data);
            return reply.status(201).send({ message: 'Pacote criado!', bundle });
        } catch (err) {
            return sendErr(reply, err);
        }
    });

    app.get('/api/v2/homebrew/bundles', { preHandler: [optionalAuth(app)] }, async (request, reply) => {
        const q = request.query as Record<string, string | undefined>;
        const scope = q.scope as 'public' | 'mine' | undefined;
        if (scope === 'mine') await app.authenticate(request);
        try {
            const bundles = await HomebrewService.getBundles({
                userId: request.userId,
                scope: scope ?? 'public',
                page: parseInt(q.page ?? '1', 10) || 1,
                limit: parseInt(q.limit ?? '100', 10) || 100,
            });
            return { bundles };
        } catch (err) {
            return sendErr(reply, err);
        }
    });

    app.get('/api/v2/homebrew/bundles/:id/contents', async (request, reply) => {
        try {
            const { id } = request.params as { id: string };
            const contents = await HomebrewService.getContentsOfBundle(id);
            return { contents };
        } catch (err) {
            return sendErr(reply, err);
        }
    });

    app.get('/api/v2/homebrew/bundles/:id/export', auth, async (request, reply) => {
        try {
            const { id } = request.params as { id: string };
            return await HomebrewService.exportBundle(id, request.userId);
        } catch (err) {
            return sendErr(reply, err);
        }
    });

    app.post('/api/v2/homebrew/bundles/import', auth, async (request, reply) => {
        try {
            const data = ImportBundleSchema.parse(request.body);
            const result = await HomebrewService.importBundle(request.userId, data);
            return reply.status(201).send(result);
        } catch (err) {
            return sendErr(reply, err);
        }
    });

    app.put('/api/v2/homebrew/bundles/:id', auth, async (request, reply) => {
        try {
            const { id } = request.params as { id: string };
            const data = UpdateBundleSchema.partial().parse(request.body);
            const bundle = await HomebrewService.updateBundle(id, request.userId, data);
            return { message: 'Pacote atualizado!', bundle };
        } catch (err) {
            return sendErr(reply, err);
        }
    });

    app.delete('/api/v2/homebrew/bundles/:id', auth, async (request, reply) => {
        try {
            const { id } = request.params as { id: string };
            await HomebrewService.deleteBundle(id, request.userId);
            return reply.status(204).send();
        } catch (err) {
            return sendErr(reply, err);
        }
    });

    app.get('/api/v2/homebrew/srd/types', async () => ({ types: HOMEBREW_TYPE_TO_SRD_RESOURCE }));

    app.get('/api/v2/homebrew/srd/:resource/:index', async (request, reply) => {
        const { resource, index } = request.params as { resource: string; index: string };
        try {
            const detail = await SrdApi.fetchSrdResourceDetail(resource, index);
            return detail;
        } catch (err) {
            return sendErr(reply, err);
        }
    });

    app.get('/api/v2/homebrew/srd/:resource', async (request, reply) => {
        const { resource } = request.params as { resource: string };
        try {
            const list = await SrdApi.fetchSrdResourceList(resource);
            return list;
        } catch (err) {
            return sendErr(reply, err);
        }
    });

    app.post('/api/v2/homebrew/from-srd', auth, async (request, reply) => {
        try {
            const data = CreateFromSrdSchema.parse(request.body);
            const content = await HomebrewService.createHomebrewFromSrd(request.userId, data);
            return reply.status(201).send({ message: 'Conteúdo criado a partir do SRD!', content });
        } catch (err) {
            return sendErr(reply, err);
        }
    });

    app.post('/api/v2/homebrew/check-name', auth, async (request, reply) => {
        const body = request.body as { name?: string; type?: PenaiHomebrewContentType };
        if (!body.name || !body.type) {
            return reply.status(400).send({ message: 'name e type são obrigatórios.' });
        }
        try {
            return await HomebrewService.checkIfNameExists(body.name, body.type);
        } catch (err) {
            return sendErr(reply, err);
        }
    });

    app.post('/api/v2/homebrew', auth, async (request, reply) => {
        try {
            const data = CreateHomebrewSchema.parse(request.body);
            const content = await HomebrewService.createHomebrewContent(request.userId, data);
            return reply.status(201).send({ message: 'Conteúdo Homebrew criado!', content });
        } catch (err) {
            return sendErr(reply, err);
        }
    });

    app.get('/api/v2/homebrew', { preHandler: [optionalAuth(app)] }, async (request, reply) => {
        const q = request.query as Record<string, string | undefined>;
        const scope = q.scope as 'public' | 'mine' | undefined;
        if (scope === 'mine') await app.authenticate(request);
        const type = q.type as PenaiHomebrewContentType | undefined;
        const createdBy = q.createdBy as 'user' | 'ai' | undefined;
        const page = parseInt(q.page ?? '1', 10) || 1;
        const limit = parseInt(q.limit ?? '100', 10) || 100;
        try {
            let content;
            if (scope === 'mine' && request.userId) {
                content = await HomebrewService.getHomebrewContentByAuthor(request.userId, type, { page, limit });
            } else {
                content = await HomebrewService.getPublicHomebrewContent(type, createdBy, { page, limit });
            }
            return { content };
        } catch (err) {
            return sendErr(reply, err);
        }
    });

    app.get('/api/v2/homebrew/:id', { preHandler: [optionalAuth(app)] }, async (request, reply) => {
        try {
            const { id } = request.params as { id: string };
            const content = await HomebrewService.getHomebrewContentById(id, request.userId);
            return { content };
        } catch (err) {
            return sendErr(reply, err);
        }
    });

    app.put('/api/v2/homebrew/:id', auth, async (request, reply) => {
        try {
            const { id } = request.params as { id: string };
            const data = CreateHomebrewSchema.parse(request.body);
            const content = await HomebrewService.updateHomebrewContent(id, request.userId, data);
            return { message: 'Conteúdo atualizado!', content };
        } catch (err) {
            return sendErr(reply, err);
        }
    });

    app.get('/api/v2/homebrew/:id/dependencies', async (request, reply) => {
        try {
            const { id } = request.params as { id: string };
            const dependencies = await HomebrewService.getHomebrewDependencies(id);
            return { dependencies };
        } catch (err) {
            return sendErr(reply, err);
        }
    });
}
