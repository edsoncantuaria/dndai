import type { FastifyInstance, FastifyReply } from 'fastify';
import { SettingsPatchSchema } from '../../../schemas/validationSchemas.js';
import {
    completePenaiUserOnboarding,
    getPenaiUserMe,
    invalidatePenaiUserCache,
    setPenaiHomebrewDisclaimerAcknowledged,
    updatePenaiUserHomebrewInstallation,
    updatePenaiUserSettings,
} from '../../../GameMaster/auth/penaiUserService.js';
import { sendHttpError } from '../../httpErrorReply.js';

export async function userRoutes(app: FastifyInstance): Promise<void> {
    const auth = { preHandler: [app.authenticate] };

    app.get('/api/v2/users/me', auth, async (request, reply) => {
        try {
            const me = await getPenaiUserMe(request.userId);
            return me;
        } catch (err) {
            return sendHttpError(reply, err);
        }
    });

    app.put('/api/v2/users/me/settings', auth, async (request, reply) => {
        try {
            const newSettings = SettingsPatchSchema.parse(request.body);
            const settings = await updatePenaiUserSettings(request.userId, newSettings);
            return { message: 'Configurações atualizadas com sucesso!', settings };
        } catch (err: unknown) {
            if (err instanceof Error && err.name === 'ZodError') {
                return reply.status(400).send({ errors: (err as { flatten?: () => unknown }).flatten?.() });
            }
            return sendHttpError(reply, err);
        }
    });

    app.post('/api/v2/users/me/acknowledge-homebrew', auth, async (request, reply) => {
        try {
            await setPenaiHomebrewDisclaimerAcknowledged(request.userId);
            return { success: true, message: 'Confirmação salva com sucesso.' };
        } catch (err) {
            return sendHttpError(reply, err);
        }
    });

    app.post('/api/v2/users/me/onboarding/complete', auth, async (request, reply) => {
        try {
            await completePenaiUserOnboarding(request.userId);
            return { success: true, onboardingCompleted: true };
        } catch (err) {
            return sendHttpError(reply, err);
        }
    });

    app.patch('/api/v2/users/me/homebrew', auth, async (request, reply) => {
        const body = request.body as { homebrewId?: string; action?: string };
        if (!body.homebrewId || (body.action !== 'install' && body.action !== 'uninstall')) {
            return reply.status(400).send({
                message: 'ID do Homebrew e ação (install/uninstall) são obrigatórios.',
            });
        }
        try {
            const user = await updatePenaiUserHomebrewInstallation(
                request.userId,
                body.homebrewId,
                body.action,
            );
            return {
                message: `Conteúdo homebrew ${body.action === 'install' ? 'instalado' : 'desinstalado'} com sucesso!`,
                user,
            };
        } catch (err) {
            return sendHttpError(reply, err);
        }
    });

    app.post('/api/v2/users/me/invalidate-cache', auth, async (request, reply) => {
        try {
            await invalidatePenaiUserCache(request.userId);
            return reply.status(204).send();
        } catch (err) {
            return sendHttpError(reply, err);
        }
    });
}
