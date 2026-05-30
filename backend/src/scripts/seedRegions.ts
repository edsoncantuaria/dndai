// backend/src/scripts/seedRegions.ts
// Legado MySQL (TypeORM regions). Stack PENAI: npm run seed:penai-world (Postgres).
import { AppDataSource } from '../database/data-source.js';
import regionGraph from '../data/regionsSeed.json' assert { type: 'json' };
import { importRegionGraph } from '../services/regionService.js';

const run = async () => {
  try {
    await AppDataSource.initialize();
    console.log('[seed:regions] Conectado ao banco.');
    await importRegionGraph(regionGraph, { clearExisting: true });
    console.log('[seed:regions] Regiões importadas com sucesso.');
    process.exit(0);
  } catch (error) {
    console.error('[seed:regions] Falha ao importar regiões:', error);
    process.exit(1);
  }
};

run();
