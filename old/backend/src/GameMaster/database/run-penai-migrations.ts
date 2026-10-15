import 'reflect-metadata';
import 'dotenv/config';
import { PenaiDataSource } from './data-source.js';
import { purgeOrphanPenaiSessionRows } from './purgeOrphanSessionRows.js';

async function main() {
    if (!PenaiDataSource.isInitialized) {
        await PenaiDataSource.initialize();
    }
    const removed = await purgeOrphanPenaiSessionRows(PenaiDataSource);
    if (removed > 0) {
        console.log(`[penai-migrations] Total órfãos removidos: ${removed}`);
    }
    const executed = await PenaiDataSource.runMigrations({ transaction: 'each' });
    if (executed.length === 0) {
        console.log('[penai-migrations] Nenhuma migração pendente.');
    } else {
        executed.forEach(m => console.log(`[penai-migrations] Aplicada: ${m.name}`));
    }
    await PenaiDataSource.destroy();
}

main().catch(err => {
    console.error('[penai-migrations] Falha:', err);
    process.exit(1);
});
