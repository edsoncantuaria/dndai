#!/usr/bin/env tsx
/** Gera JSON em data/penai-seed/auto-canon-npcs/ a partir do catálogo Cursor Auto. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    AUTO_CANON_NPC_BY_REGION,
    toMockFile,
} from '../GameMaster/world/seed/buildAutoCanonNpcMockCatalog.js';
import { generateAutoRegionNpcPack } from '../GameMaster/world/seed/generateAutoRegionNpcPack.js';
import { reserveGivenNames } from '../GameMaster/world/npcGlobalGivenNamePool.js';
import { listCanonicalRegionSlugs } from '../GameMaster/world/canonicalNpcSeed.js';
import { initPenaiDatabase, PenaiDataSource } from '../GameMaster/database/data-source.js';
import { getRegionBySlug } from '../GameMaster/world/travelCanon.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../../data/penai-seed/auto-canon-npcs');

await initPenaiDatabase();
const slugs = await listCanonicalRegionSlugs();
fs.mkdirSync(outDir, { recursive: true });

const reserved = new Set<string>();
for (const pack of Object.values(AUTO_CANON_NPC_BY_REGION)) {
    reserveGivenNames(pack.npcs.map(n => n.givenName), reserved);
}

for (const slug of slugs) {
    const meta = await getRegionBySlug(slug);
    const regionName = meta?.displayName ?? slug;
    const pack =
        AUTO_CANON_NPC_BY_REGION[slug] ??
        generateAutoRegionNpcPack(slug, regionName, reserved);
    const file = toMockFile(slug, pack);
    fs.writeFileSync(path.join(outDir, `${slug}.json`), JSON.stringify(file, null, 2), 'utf-8');
    console.log(`✓ ${slug}.json (${file.npcs.length} NPCs)`);
}

await PenaiDataSource.destroy();
