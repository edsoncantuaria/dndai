import 'reflect-metadata';
import 'dotenv/config';
import { AppDataSource } from './data-source.js';

async function main() {
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
    }
    const executed = await AppDataSource.runMigrations({ transaction: 'each' });
    if (executed.length === 0) {
        console.log('[migrations] Nenhuma migração pendente.');
    } else {
        executed.forEach(m => console.log(`[migrations] Aplicada: ${m.name}`));
    }
    await AppDataSource.destroy();
}

main().catch(err => {
    console.error('[migrations] Falha:', err);
    process.exit(1);
});
