#!/usr/bin/env tsx
/**
 * Importa NPCs mock gerados pelo Cursor Auto (JSON em data/penai-seed/auto-canon-npcs/).
 *
 *   npm run penai:seed:auto-npcs -- --region selva-de-ashari
 *   npm run penai:seed:auto-npcs -- --all
 *   npm run penai:seed:auto-npcs -- --all --replace-region
 */
import '../config/loadPenaiDotenv.js';
import { PenaiDataSource, initPenaiDatabase } from '../GameMaster/database/data-source.js';
import {
    countCanonNpcsInRegion,
    formatCanonNpcSeedRow,
    listCanonicalRegionSlugs,
    materializeCanonicalNpcs,
    retireCanonNpcsInRegion,
} from '../GameMaster/world/canonicalNpcSeed.js';
import { buildNpcCombatSheetForDraft } from '../GameMaster/world/npcSheet.js';
import {
    draftsFromAutoCanonMock,
    listAutoCanonNpcMockRegionSlugs,
    loadAutoCanonNpcMockFile,
    resolveAutoCanonNpcMockDir,
} from '../GameMaster/world/seed/loadAutoCanonNpcMock.js';
import { getRegionBySlug } from '../GameMaster/world/travelCanon.js';
import { loadReservedNpcGivenNames } from '../GameMaster/world/npcUniqueNames.js';
import { dedupeNpcDrafts } from '../GameMaster/world/npcUniqueNames.js';

function argValue(flag: string): string | undefined {
    const i = process.argv.indexOf(flag);
    if (i < 0) return undefined;
    return process.argv[i + 1];
}

function hasFlag(flag: string): boolean {
    return process.argv.includes(flag);
}

const regionArg = argValue('--region');
const all = hasFlag('--all');
const replaceRegion = hasFlag('--replace-region');
const heroLevel = Number(argValue('--hero-level') ?? '3');

if (!regionArg && !all) {
    console.error(`
Uso:
  npm run penai:seed:auto-npcs -- --region <slug>
  npm run penai:seed:auto-npcs -- --all [--replace-region]
  JSON em: ${resolveAutoCanonNpcMockDir()}
`);
    process.exit(1);
}

/** Mock Cursor Auto — só Postgres; sem embedding Gemini no Qdrant. */
process.env.PENAI_SKIP_NPC_EMBED = 'true';

await initPenaiDatabase();

const mockSlugs = new Set(listAutoCanonNpcMockRegionSlugs());
const targetSlugs = all
    ? (await listCanonicalRegionSlugs()).filter(s => mockSlugs.has(s))
    : [regionArg!];

if (!targetSlugs.length) {
    console.error('Nenhum JSON mock encontrado para as regiões pedidas.');
    process.exit(1);
}

let globalReserved = await loadReservedNpcGivenNames();
let failed = 0;

for (const regionSlug of targetSlugs) {
    const mock = loadAutoCanonNpcMockFile(regionSlug);
    if (!mock) {
        console.error(`✖ Sem mock: ${regionSlug}.json`);
        failed += 1;
        continue;
    }

    const meta = await getRegionBySlug(regionSlug);
    const regionName = meta?.displayName ?? mock.regionName ?? regionSlug;
    const before = await countCanonNpcsInRegion(regionSlug);

    if (replaceRegion) {
        const retired = await retireCanonNpcsInRegion(regionSlug);
        if (retired > 0) console.log(`  ↻ ${regionSlug}: ${retired} aposentados`);
        globalReserved = await loadReservedNpcGivenNames();
    }

    let drafts = draftsFromAutoCanonMock(mock);
    drafts = dedupeNpcDrafts(drafts, globalReserved, regionSlug);

    if (drafts.length < mock.npcs.length) {
        console.warn(
            `  ⚠ ${regionSlug}: dedupe ${drafts.length}/${mock.npcs.length} (nomes reservados)`,
        );
    }

    const materialized = await materializeCanonicalNpcs({
        regionSlug,
        npcs: drafts,
        heroLevel,
        alwaysCreate: true,
    });

    const rows = drafts.map((d, i) => {
        const sheet = buildNpcCombatSheetForDraft(d, heroLevel, regionSlug);
        const mat = materialized[i];
        return formatCanonNpcSeedRow(d, sheet, mat?.entityId ?? 'unknown', mat?.reused ?? false);
    });

    const after = await countCanonNpcsInRegion(regionSlug);
    console.log(
        JSON.stringify(
            {
                regionSlug,
                regionName,
                source: 'cursor-auto',
                before,
                after,
                imported: rows.length,
                sample: rows.slice(0, 2),
            },
            null,
            2,
        ),
    );
}

await PenaiDataSource.destroy();
if (failed > 0) process.exit(1);
