#!/usr/bin/env tsx
/**
 * Seed de NPCs canônicos por região — mesmo pipeline do world bootstrap (Gemini + ficha + Qdrant).
 *
 * Uso:
 *   npm run penai:seed:canon-npcs -- --region cidadela-do-acoluz
 *   npm run penai:seed:canon-npcs -- --all --count 20
 *   npm run penai:seed:canon-npcs -- --region porto-corsario --count 20 --hero-level 5 --dry-run
 *   npm run penai:seed:canon-npcs -- --region x --reuse   (permite Qdrant reutilizar por nome)
 *
 * Requer: Postgres + GEMINI_API_KEY (raiz .env ou --api-key). Sem Gemini válido, não cria NPCs.
 */
import '../config/loadPenaiDotenv.js';
import { PenaiDataSource, initPenaiDatabase } from '../GameMaster/database/data-source.js';
import { hasResolvableGeminiKey } from '../GameMaster/adapters/gemini/apiKey.js';
import {
    CANON_NPC_BATCH_SIZE,
    CANON_NPC_TARGET_MAX,
    countCanonNpcsInRegion,
    listCanonicalRegionSlugs,
    resolveCanonNpcTarget,
    seedCanonicalNpcsForRegion,
} from '../GameMaster/world/canonicalNpcSeed.js';
import { loadReservedNpcGivenNames } from '../GameMaster/world/npcUniqueNames.js';
import { WorldGeminiGenerationError } from '../GameMaster/world/agents/worldGeminiGenerationError.js';

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
const count = Number(argValue('--count') ?? '20');
const heroLevel = Number(argValue('--hero-level') ?? '3');
const dryRun = hasFlag('--dry-run');
const allowReuse = hasFlag('--reuse');
const force = hasFlag('--force');
const replaceRegion = hasFlag('--replace-region');
/** Padrão: ficha SRD no servidor (sem Gemini). Use --gemini só se quiser IA. */
const geminiMode = hasFlag('--gemini');
const serverMode = !geminiMode;
const fillTarget = hasFlag('--fill') || serverMode;
const maxBatches = fillTarget ? undefined : geminiMode ? 1 : undefined;
const apiKeyArg = argValue('--api-key');
const targetPerRegion = resolveCanonNpcTarget(count);
const listOnly = hasFlag('--list-regions');

if (listOnly) {
    await initPenaiDatabase();
    const slugs = await listCanonicalRegionSlugs();
    console.log(JSON.stringify({ regions: slugs }, null, 2));
    await PenaiDataSource.destroy();
    process.exit(0);
}

if (!regionArg && !all) {
    console.error(`
Uso:
  npm run penai:seed:canon-npcs -- --region <slug> [--count 20] [--hero-level 3]
  npm run penai:seed:canon-npcs -- --all [--count 20]
  npm run penai:seed:canon-npcs -- --list-regions
  Flags: --dry-run  --reuse  --force  --fill  --gemini (usa API Gemini)
  --replace-region (aposenta e recria — omita para manter NPCs existentes)
  Padrão: servidor (FOR–CAR, classe, magias SRD) — até 20 NPCs/região por execução

  GEMINI: GEMINI_API_KEY na raiz ou --api-key.
`);
    process.exit(1);
}

await initPenaiDatabase();

if (geminiMode && !hasResolvableGeminiKey(apiKeyArg)) {
    console.error('\n✖ GEMINI_API_KEY obrigatória com --gemini.\n');
    await PenaiDataSource.destroy();
    process.exit(1);
}
if (serverMode) {
    console.log(
        `✓ Seed local (sem Gemini) — até ${targetPerRegion} NPCs/região com atributos SRD.\n`,
    );
} else {
    const { penaiEnv } = await import('../config/penaiEnv.js');
    console.log(
        `✓ Gemini: ${penaiEnv.GEMINI_GENERATION_MODEL} — alvo ${targetPerRegion}/região, lote ${CANON_NPC_BATCH_SIZE}.\n`,
    );
}
if (count !== targetPerRegion) {
    console.log(`  ( --count ${count} limitado a ${targetPerRegion} )\n`);
}

if (process.env.QDRANT_ENABLED !== 'false') {
    try {
        const { QdrantClient } = await import('@qdrant/js-client-rest');
        const { penaiEnv } = await import('../config/penaiEnv.js');
        const probe = new QdrantClient({
            url: penaiEnv.QDRANT_URL,
            timeout: 3_000,
            checkCompatibility: false,
        });
        await probe.getCollections();
        const { ensurePenaiQdrantCollections } = await import('../GameMaster/memory/qdrantPenai.js');
        await ensurePenaiQdrantCollections();
        console.log('[penai:seed:canon-npcs] Qdrant OK — perfis NPC serão indexados.\n');
    } catch {
        console.log(
            '[penai:seed:canon-npcs] Qdrant indisponível (127.0.0.1:6333) — NPCs só no Postgres; suba Qdrant depois se precisar de busca vetorial.\n',
        );
    }
}

const slugs = all ? await listCanonicalRegionSlugs() : [regionArg!];
const summary: Array<Record<string, unknown>> = [];
/** Nomes já usados no mundo + acumulados entre regiões em `--all`. */
let globalReserved = await loadReservedNpcGivenNames();
let failedRegions = 0;

const regionDelayMs = Math.max(
    0,
    Number(process.env.PENAI_SEED_REGION_DELAY_MS ?? (all ? '8000' : '0')),
);

for (let i = 0; i < slugs.length; i++) {
    const regionSlug = slugs[i]!;
    if (i > 0 && regionDelayMs > 0) {
        console.log(`  ⏳ aguardando ${regionDelayMs}ms antes da próxima região…`);
        await new Promise(r => setTimeout(r, regionDelayMs));
    }
    const before = await countCanonNpcsInRegion(regionSlug);
    console.log(`\n▶ [${i + 1}/${slugs.length}] ${regionSlug} (NPCs canônicos atuais: ${before})…`);

    try {
        const result = await seedCanonicalNpcsForRegion({
            regionSlug,
            npcCount: targetPerRegion,
            heroLevel,
            alwaysCreate: !allowReuse,
            dryRun,
            force,
            replaceRegion,
            maxBatches,
            seedMode: geminiMode ? 'gemini' : 'server',
            userApiKey: apiKeyArg,
            reservedNames: globalReserved,
        });

        if (result.source === 'skipped') {
            console.log(
                `  ⊘ já tem ${before}/${result.targetTotal} NPCs — use --replace-region para recriar com IA ou --force para +${CANON_NPC_BATCH_SIZE}`,
            );
        }

        const after = dryRun ? before : await countCanonNpcsInRegion(regionSlug);
        summary.push({
            regionSlug,
            regionName: result.regionName,
            before,
            after,
            targetTotal: result.targetTotal,
            requested: result.requested,
            batches: result.batches,
            created: result.created,
            reused: result.reused,
            source: result.source,
            sample: result.npcs.slice(0, 3),
        });

        console.log(
            JSON.stringify(
                {
                    regionSlug,
                    targetTotal: result.targetTotal,
                    batches: result.batches,
                    created: result.created,
                    reused: result.reused,
                    source: result.source,
                    totalInRegion: after,
                    sample: result.npcs.slice(0, 2),
                },
                null,
                2,
            ),
        );
    } catch (err) {
        failedRegions += 1;
        const reason = err instanceof WorldGeminiGenerationError ? err.reason : 'error';
        const detail = err instanceof Error ? err.message : String(err);
        console.error(`  ✖ falhou [${reason}]: ${detail}`);
        summary.push({ regionSlug, before, failed: true, reason, detail });
    }
}

console.log('\n━━━━━━━━ Resumo ━━━━━━━━');
console.log(
    JSON.stringify(
        { dryRun, targetPerRegion, heroLevel, replaceRegion, force, failedRegions, regions: summary },
        null,
        2,
    ),
);

await PenaiDataSource.destroy();
if (failedRegions > 0) process.exit(1);
