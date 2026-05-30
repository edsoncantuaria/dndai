/**
 * Insere chave de licença PENAI (idempotente).
 * Uso: npm run seed:penai-license --prefix backend -- TESTE-1
 */
import 'dotenv/config';
import { PenaiDataSource } from '../GameMaster/database/data-source.js';
import { PenaiLicenseKey } from '../GameMaster/database/entities/PenaiLicenseKey.js';

const key = (process.argv[2] ?? 'TESTE-1').trim().toUpperCase();

const run = async () => {
    await PenaiDataSource.initialize();
    const repo = PenaiDataSource.getRepository(PenaiLicenseKey);
    const existing = await repo.findOne({ where: { key } });
    if (existing) {
        console.log('[seed:penai-license] já existe:', {
            id: existing.id,
            key: existing.key,
            isActivated: existing.isActivated,
            expiresAt: existing.expiresAt,
        });
    } else {
        const row = await repo.save(repo.create({ key, isActivated: false }));
        console.log('[seed:penai-license] criada:', {
            id: row.id,
            key: row.key,
            isActivated: row.isActivated,
        });
    }
    await PenaiDataSource.destroy();
};

run().catch((err) => {
    console.error('[seed:penai-license] falhou:', err);
    process.exit(1);
});
