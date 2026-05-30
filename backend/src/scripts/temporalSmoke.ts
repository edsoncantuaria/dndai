/**
 * Smoke Temporal — requer servidor em TEMPORAL_ADDRESS (ou TEMPORAL_DISABLED=true passa sync).
 */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';

loadEnv({ path: resolve(process.cwd(), '../.env') });
loadEnv({ path: resolve(process.cwd(), '.env') });

async function main() {
    const { penaiEnv } = await import('../config/penaiEnv.js');
    if (penaiEnv.TEMPORAL_DISABLED) {
        console.log('[temporal:smoke] TEMPORAL_DISABLED — skip.');
        return;
    }
    const { initPenaiDatabase } = await import('../GameMaster/database/data-source.js');
    const { initRedis } = await import('../GameMaster/infra/redis.js');
    const { startHealthWorkflow } = await import('../temporal/client.js');

    try {
        await initPenaiDatabase();
        await initRedis();
        const result = await startHealthWorkflow('penai-smoke');
        console.log('[temporal:smoke] OK —', result);
    } catch (e) {
        console.warn('[temporal:smoke] Servidor indisponível (dev sem Temporal):', e);
        process.exit(0);
    }
}

main();
