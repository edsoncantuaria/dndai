import type { FastifyInstance, FastifyReply } from 'fastify';
import { NewCharacterInfoSchema } from '../../../schemas/validationSchemas.js';
import {
    createVaultHero,
    deleteVaultHero,
    getVaultHero,
    listVaultHeroes,
} from '../../../GameMaster/character/heroVaultPenai.js';
import createError from 'http-errors';

function sendErr(reply: FastifyReply, err: unknown) {
    if (createError.isHttpError(err)) {
        return reply.status(err.statusCode).send({ message: err.message, error: err.message });
    }
    throw err;
}

export async function characterRoutes(app: FastifyInstance): Promise<void> {
    const auth = { preHandler: [app.authenticate] };

    app.post('/api/v2/characters', auth, async (request, reply) => {
        try {
            const parsed = NewCharacterInfoSchema.parse(request.body);
            const character = await createVaultHero(request.userId, parsed);
            return reply.status(201).send({ message: 'Personagem criado!', character });
        } catch (err) {
            return sendErr(reply, err);
        }
    });

    app.get('/api/v2/characters', auth, async (request) => {
        const characters = await listVaultHeroes(request.userId);
        return { characters };
    });

    app.get('/api/v2/characters/:id', auth, async (request, reply) => {
        const { id } = request.params as { id: string };
        const character = await getVaultHero(request.userId, id);
        if (!character) return reply.notFound('Personagem não encontrado.');
        return { character };
    });

    app.delete('/api/v2/characters/:id', auth, async (request, reply) => {
        const { id } = request.params as { id: string };
        const ok = await deleteVaultHero(request.userId, id);
        if (!ok) return reply.notFound('Personagem não encontrado.');
        return reply.status(204).send();
    });
}
