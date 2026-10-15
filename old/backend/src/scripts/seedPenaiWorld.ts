/**
 * Seed do mundo canônico PENAI (PostgreSQL) a partir de regionsSeed.json.
 * Requer: npm run dev:infra (Postgres em localhost:5433)
 *
 * Reimportar (apaga mundo canônico): PENAI_WORLD_SEED_FORCE=true npm run seed:penai-world --prefix backend
 */
import 'dotenv/config';
import { PenaiDataSource } from '../GameMaster/database/data-source.js';
import { CanonicalRegion } from '../GameMaster/database/entities/CanonicalRegion.js';
import { CanonicalPoi } from '../GameMaster/database/entities/CanonicalPoi.js';
import { CanonicalRegionLink } from '../GameMaster/database/entities/CanonicalRegionLink.js';
import { seedPenaiWorld } from '../GameMaster/database/seed/seedWorldPtBr.js';

const run = async () => {
    if (process.argv.includes('--force') && process.env.PENAI_WORLD_SEED_FORCE !== 'true') {
        process.env.PENAI_WORLD_SEED_FORCE = 'true';
    }
    try {
        await PenaiDataSource.initialize();
        console.log('[seed:penai-world] PostgreSQL conectado.');
        await seedPenaiWorld();
        const stats = {
            regions: await PenaiDataSource.getRepository(CanonicalRegion).count(),
            pois: await PenaiDataSource.getRepository(CanonicalPoi).count(),
            links: await PenaiDataSource.getRepository(CanonicalRegionLink).count(),
        };
        console.log('[seed:penai-world] Concluído.', stats);
        await PenaiDataSource.destroy();
        process.exit(0);
    } catch (error) {
        console.error('[seed:penai-world] Falha:', error);
        process.exit(1);
    }
};

run();
