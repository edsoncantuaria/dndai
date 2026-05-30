import type { FastifyInstance } from 'fastify';
import { penaiEnv } from '../../../config/penaiEnv.js';
import { isPenaiDatabaseReady } from '../../../GameMaster/database/data-source.js';
import { checkRedisHealth } from '../../../GameMaster/infra/redis.js';
import { checkTemporalHealth } from '../../../temporal/client.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
    app.get('/api/v2/health', async () => ({
        status: 'UP',
        message: 'Crônicas de Aventuras — PENAI / GameMaster',
        locale: penaiEnv.DEFAULT_LOCALE,
        apiVersion: penaiEnv.API_VERSION,
        engine: 'penai',
    }));

    app.get('/api/v2/admin/health', async () => {
        const [postgres, redis, temporal] = await Promise.all([
            isPenaiDatabaseReady(),
            checkRedisHealth(),
            checkTemporalHealth(),
        ]);
        const ok = postgres.ok && redis.ok;
        return {
            status: ok ? 'UP' : 'DEGRADED',
            checks: {
                postgres,
                redis,
                temporal,
                qdrant: { ok: !penaiEnv.QDRANT_ENABLED, message: penaiEnv.QDRANT_ENABLED ? 'habilitado' : 'desligado' },
            },
            locale: penaiEnv.DEFAULT_LOCALE,
        };
    });
}
