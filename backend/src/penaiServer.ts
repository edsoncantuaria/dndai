import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';

loadEnv({ path: resolve(process.cwd(), '../.env') });
loadEnv({ path: resolve(process.cwd(), '.env') });

import { buildPenaiApp } from './app/server.js';
import { penaiEnv } from './config/penaiEnv.js';
import { initPenaiDatabase } from './GameMaster/database/data-source.js';
import { initRedis } from './GameMaster/infra/redis.js';
import { startWsPubSubSubscriber } from './GameMaster/transport/wsPubSub.js';
import { ensureDefaultLocale } from './GameMaster/locale/defaultLocale.js';
import { isPenaiPipelineLogEnabled } from './GameMaster/infra/pipelineLog.js';

async function main() {
    ensureDefaultLocale();
    if (isPenaiPipelineLogEnabled()) {
        console.log(
            '[PENAI] Pipeline log ATIVO — grep "[PENAI][pipeline]" nos logs (desligar: PENAI_PIPELINE_LOG=0)',
        );
    }

    await initPenaiDatabase();
    if (penaiEnv.QDRANT_ENABLED) {
        const { ensurePenaiQdrantCollections } = await import('./GameMaster/memory/qdrantPenai.js');
        await ensurePenaiQdrantCollections().catch(err => {
            console.warn('[PENAI][Qdrant] Coleções não preparadas:', err);
        });
    }
    await initRedis();
    await startWsPubSubSubscriber();

    const app = await buildPenaiApp();

    if (!penaiEnv.SKIP_TEMPORAL_WORKER && !penaiEnv.TEMPORAL_DISABLED) {
        const { startPenaiTemporalWorker } = await import('./temporal/worker.js');
        void startPenaiTemporalWorker().catch(err => {
            console.error('[PENAI] Falha ao iniciar worker Temporal:', err);
        });
    } else {
        console.log('[PENAI] Worker Temporal não iniciado neste processo (SKIP_TEMPORAL_WORKER ou TEMPORAL_DISABLED).');
    }

    await app.listen({ port: penaiEnv.PORT, host: '0.0.0.0' });
    console.log(`[PENAI] Fastify rodando em http://localhost:${penaiEnv.PORT} (locale=${penaiEnv.DEFAULT_LOCALE})`);
}

main().catch(err => {
    console.error('[PENAI] Falha fatal no bootstrap:', err);
    process.exit(1);
});
