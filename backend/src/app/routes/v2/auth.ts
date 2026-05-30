import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { RegisterSchema, LoginSchema } from '../../../schemas/validationSchemas.js';
import { loginPenaiUser, registerPenaiUser } from '../../../GameMaster/auth/penaiAuthService.js';
import createError from 'http-errors';

function sendHttpError(reply: FastifyReply, err: unknown) {
    if (createError.isHttpError(err)) {
        const body: Record<string, unknown> = { message: err.message, error: err.message };
        if ((err as { errors?: unknown }).errors) {
            body.errors = (err as { errors?: unknown }).errors;
        }
        return reply.status(err.statusCode).send(body);
    }
    throw err;
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
    app.post('/api/v2/auth/register', async (request, reply) => {
        const parsed = RegisterSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Dados inválidos',
                details: parsed.error.flatten(),
            });
        }
        try {
            const user = await registerPenaiUser(parsed.data);
            return reply.status(201).send({
                success: true,
                message: 'Usuário registrado com sucesso!',
                user,
            });
        } catch (err) {
            return sendHttpError(reply, err);
        }
    });

    app.post('/api/v2/auth/login', async (request, reply) => {
        const parsed = LoginSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Dados inválidos',
                details: parsed.error.flatten(),
            });
        }
        try {
            const { user, tokenPayload } = await loginPenaiUser(
                parsed.data.login,
                parsed.data.password,
            );
            const token = app.jwt.sign(tokenPayload, { expiresIn: '7d' });
            return reply.send({
                success: true,
                message: 'Login realizado com sucesso!',
                token,
                user,
            });
        } catch (err) {
            return sendHttpError(reply, err);
        }
    });
}
