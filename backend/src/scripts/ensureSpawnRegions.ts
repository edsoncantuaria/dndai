// Garante cidades no spawn pool (usado no entrypoint Docker e manualmente).
import { AppDataSource } from '../database/data-source.js';
import { ensureDefaultSpawnRegions } from '../services/regionService.js';

const run = async () => {
  try {
    await AppDataSource.initialize();
    const ok = await ensureDefaultSpawnRegions();
    if (ok) {
      console.log('[ensure:spawn] Spawn pool de cidades pronto.');
      process.exit(0);
    }
    console.error('[ensure:spawn] Nenhuma cidade spawnável após bootstrap.');
    process.exit(1);
  } catch (error) {
    console.error('[ensure:spawn] Falha:', error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
};

void run();
