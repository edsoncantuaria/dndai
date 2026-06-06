import type { FastifyInstance, FastifyReply } from 'fastify';
import { ActivateLicenseSchema } from '../../../schemas/validationSchemas.js';
import {
    activatePenaiLicense,
    getPenaiLicenseStatus,
} from '../../../GameMaster/auth/penaiLicenseService.js';
import { sendHttpError } from '../../httpErrorReply.js';

function sendErr(reply: FastifyReply, err: unknown) {
    return sendHttpError(reply, err);
}

export async function licenseRoutes(app: FastifyInstance): Promise<void> {
    const auth = { preHandler: [app.authenticate] };

    app.post('/api/v2/licenses/activate', auth, async (request, reply) => {
        try {
            const { key } = ActivateLicenseSchema.parse(request.body);
            await activatePenaiLicense(key, request.userId);
            return { success: true, message: 'Licença ativada com sucesso!' };
        } catch (err) {
            return sendErr(reply, err);
        }
    });

    app.get('/api/v2/licenses/status', auth, async (request, reply) => {
        try {
            const isActive = await getPenaiLicenseStatus(request.userId);
            return { isActive };
        } catch (err) {
            return sendErr(reply, err);
        }
    });
}
