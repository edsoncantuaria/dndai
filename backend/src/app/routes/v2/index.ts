import type { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.js';
import { sessionRoutes } from './sessions.js';
import { worldRoutes } from './world.js';
import { adminRoutes } from './admin.js';
import { authRoutes } from './auth.js';
import { userRoutes } from './users.js';
import { homebrewRoutes } from './homebrew.js';
import { dataRoutes } from './data.js';
import { characterRoutes } from './characters.js';
import { licenseRoutes } from './licenses.js';
import { ttsRoutes } from './tts.js';

export async function registerV2Routes(app: FastifyInstance): Promise<void> {
    await healthRoutes(app);
    await authRoutes(app);
    await userRoutes(app);
    await licenseRoutes(app);
    await ttsRoutes(app);
    await homebrewRoutes(app);
    await dataRoutes(app);
    await characterRoutes(app);
    await sessionRoutes(app);
    await worldRoutes(app);
    await adminRoutes(app);
}
