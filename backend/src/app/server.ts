import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { registerCors } from './plugins/cors.js';
import { registerSensible } from './plugins/sensible.js';
import { registerRateLimit } from './plugins/rateLimit.js';
import { registerAuth } from './plugins/auth.js';
import { registerOtelHooks } from './plugins/otel.js';
import { registerV2Routes } from './routes/v2/index.js';
import { registerGameMasterWebSocket } from '../GameMaster/transport/wsHandlers.js';

export async function buildPenaiApp() {
    const app = Fastify({
        logger: {
            level: process.env.LOG_LEVEL ?? 'info',
        },
        trustProxy: true,
        bodyLimit: 10 * 1024 * 1024,
    });

    await registerCors(app);
    await registerSensible(app);
    await registerOtelHooks(app);
    await registerAuth(app);
    await registerRateLimit(app);
    await app.register(websocket);
    await registerV2Routes(app);
    await registerGameMasterWebSocket(app);

    app.setErrorHandler((error, _request, reply) => {
        const err = error as Error & { statusCode?: number };
        const status = err.statusCode ?? 500;
        app.log.error(err);
        reply.status(status).send({
            error: status >= 500 ? 'Erro interno do servidor' : err.message,
            message: err.message,
        });
    });

    return app;
}
