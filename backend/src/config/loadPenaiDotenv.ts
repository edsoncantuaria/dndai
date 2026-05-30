import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Carrega `.env` do monorepo (raiz) e do `backend/` — seed/CLI costumam rodar só no backend. */
export function loadPenaiDotenv(): void {
    const configDir = path.dirname(fileURLToPath(import.meta.url));
    const backendRoot = path.resolve(configDir, '../..');
    const repoRoot = path.resolve(backendRoot, '..');
    config({ path: path.join(repoRoot, '.env') });
    config({ path: path.join(backendRoot, '.env') });
}

loadPenaiDotenv();
