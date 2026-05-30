import 'reflect-metadata';
import 'dotenv/config';
import { PenaiDataSource } from '../GameMaster/database/data-source.js';

async function main() {
    if (!PenaiDataSource.isInitialized) {
        await PenaiDataSource.initialize();
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
