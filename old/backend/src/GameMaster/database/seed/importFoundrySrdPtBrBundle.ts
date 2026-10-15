/**
 * Pré-baixa compendiums Foundry e importa overrides de raças.
 *
 * Uso: npm run penai:import:foundry-bundle --prefix backend
 */
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { prefetchAllFoundryCompendiums } from './foundrySrdPtBrClient.js';
import { importFoundrySrdPtBrOverrides } from './importFoundrySrdPtBrOverrides.js';
import { buildFoundrySrdPtBrTranslations } from './buildFoundrySrdPtBrTranslations.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../../../../data/srdPtBr/overrides');

export async function importFoundrySrdPtBrBundle(options?: {
    skipFetch?: boolean;
}): Promise<{
    cached: string[];
    raceOverrides: number;
    translationRows: number;
    source: string;
}> {
    const cached = await prefetchAllFoundryCompendiums(options);
    const raceResult = await importFoundrySrdPtBrOverrides(options);
    const rows = await buildFoundrySrdPtBrTranslations({ skipFetch: true });

    return {
        cached,
        raceOverrides: raceResult.written,
        translationRows: rows.length,
        source: raceResult.source,
    };
}

const isMain =
    process.argv[1] != null &&
    import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
    importFoundrySrdPtBrBundle()
        .then(result => {
            console.log(
                `[importFoundryBundle] ${result.cached.length} compendiums em cache, ` +
                    `${result.raceOverrides} overrides de raça, ` +
                    `${result.translationRows} traduções mapeadas (${result.source})`,
            );
            console.log(`[importFoundryBundle] overrides em ${OUT_DIR}`);
        })
        .catch(err => {
            console.error('[importFoundryBundle] falhou:', err);
            process.exit(1);
        });
}
