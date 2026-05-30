import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';

loadEnv({ path: resolve(process.cwd(), '../.env') });
loadEnv({ path: resolve(process.cwd(), '.env') });

import { initPenaiDatabase } from './GameMaster/database/data-source.js';
import { initRedis } from './GameMaster/infra/redis.js';
import { startPenaiTemporalWorker } from './temporal/worker.js';

async function main() {
    await initPenaiDatabase();
    await initRedis();
    await startPenaiTemporalWorker();
}

main().catch(err => {
    console.error('[temporal-worker] Falha:', err);
    process.exit(1);
});
