import { PenaiDataSource } from '../database/data-source.js';
import { WorldEntity } from '../database/entities/WorldEntity.js';
import { CanonicalRegion } from '../database/entities/CanonicalRegion.js';
import { createNpcEntity } from './entityRegistry.js';
import { findFactionsByRegionSlug } from './factionCatalog.js';
import { getRegionBySlug } from './travelCanon.js';
import {
    generateBootstrapNpcs,
    type BootstrapNpcDraft,
} from './agents/worldBootstrapNpcAgent.js';
import {
    buildNpcCombatSheetForDraft,
    npcCastFromEntity,
    type NpcAtributosPt,
    type NpcWorldStats,
    type BuiltNpcSheet,
} from './npcSheet.js';
import {
    dedupeNpcDrafts,
    loadReservedNpcGivenNames,
} from './npcUniqueNames.js';
import { getNpcSpellDisplayName } from './npcSrdSpells.js';
import { generateServerCanonNpcDrafts } from './generateServerCanonNpcDrafts.js';

export type CanonNpcSeedMode = 'gemini' | 'server';

export type CanonNpcSeedRow = {
    entityId: string;
    displayName: string;
    givenName: string;
    roleTitle: string;
    level: number;
    vida: number;
    vidaMax: number;
    role: string;
    reused: boolean;
    /** FOR/DES/CON/INT/SAB/CAR persistidos no srdBuild. */
    atributos: NpcAtributosPt;
    characterClass: string;
    isSpellcaster: boolean;
    spells: string[];
};

/** Máximo por chamada Gemini (schema leve + cota API). */
export const CANON_NPC_BATCH_SIZE = 5;

/** Alvo máximo de NPCs vivos por região no seed canônico. */
export const CANON_NPC_TARGET_MAX = 200;

export type CanonicalNpcSeedResult = {
    regionSlug: string;
    regionName: string;
    /** Alvo total de NPCs na região após o seed. */
    targetTotal: number;
    requested: number;
    created: number;
    reused: number;
    skipped: number;
    batches: number;
    source: CanonNpcSeedMode | 'skipped';
    npcs: CanonNpcSeedRow[];
};

export function formatCanonNpcSeedRow(
    draft: BootstrapNpcDraft,
    sheet: BuiltNpcSheet,
    entityId: string,
    reused: boolean,
): CanonNpcSeedRow {
    const srd = sheet.worldStats.srdBuild;
    return {
        entityId,
        displayName: draft.displayName,
        givenName: draft.givenName,
        roleTitle: draft.roleTitle,
        level: sheet.worldStats.level,
        vida: sheet.worldStats.vida,
        vidaMax: sheet.worldStats.vidaMax,
        role: draft.role,
        reused,
        atributos: srd.atributos,
        characterClass: srd.characterClassLabel,
        isSpellcaster: srd.isSpellcaster,
        spells: (srd.spells ?? []).map(idx => getNpcSpellDisplayName(idx)),
    };
}

/** Marca NPCs vivos da região como retired (antes de re-seed com ficha Gemini). */
export async function retireCanonNpcsInRegion(regionSlug: string): Promise<number> {
    const result = await PenaiDataSource.getRepository(WorldEntity)
        .createQueryBuilder()
        .update(WorldEntity)
        .set({ statusGlobal: 'retired' })
        .where("entityType = 'npc'")
        .andWhere("statusGlobal = 'alive'")
        .andWhere("stats->>'homeRegion' = :slug", { slug: regionSlug })
        .execute();
    return result.affected ?? 0;
}

export function resolveCanonNpcTarget(requested?: number): number {
    const n = requested ?? 20;
    return Math.max(1, Math.min(CANON_NPC_TARGET_MAX, Math.round(n)));
}

export async function countCanonNpcsInRegion(regionSlug: string): Promise<number> {
    const repo = PenaiDataSource.getRepository(WorldEntity);
    return repo
        .createQueryBuilder('e')
        .where("e.entityType = 'npc'")
        .andWhere("e.statusGlobal = 'alive'")
        .andWhere("e.stats->>'homeRegion' = :slug", { slug: regionSlug })
        .getCount();
}

/** Persiste NPCs no canon (`world_entities` + Qdrant) — mesmo pipeline do bootstrap. */
export async function materializeCanonicalNpcs(opts: {
    regionSlug: string;
    npcs: BootstrapNpcDraft[];
    heroLevel: number;
    userId?: number;
    /** true = sempre novo registro (seed em massa); false = reutiliza por nome (bootstrap). */
    alwaysCreate?: boolean;
}): Promise<CanonicalNpcSeedResult['npcs']> {
    const repo = PenaiDataSource.getRepository(WorldEntity);
    const results: CanonicalNpcSeedResult['npcs'] = [];

    for (const draft of opts.npcs) {
        const sheet = buildNpcCombatSheetForDraft(draft, opts.heroLevel, opts.regionSlug);
        let entity: WorldEntity;
        let reused = false;

        if (opts.alwaysCreate) {
            entity = await createNpcEntity({
                displayName: draft.displayName,
                description: draft.description,
                stats: sheet.worldStats as unknown as Record<string, unknown>,
                personality: {
                    goals: [{ id: 'g-canon-seed', description: draft.goal, priority: 'medium' }],
                },
                createdByUserId: opts.userId ?? null,
                entityTier: draft.tier,
            });
        } else {
            try {
                const { findOrReuseNpcEntity } = await import('./entityRegistry.js');
                const result = await findOrReuseNpcEntity({
                    displayName: draft.displayName,
                    description: draft.description,
                    createdByUserId: opts.userId,
                    entityTier: draft.tier,
                    stats: sheet.worldStats as unknown as Record<string, unknown>,
                    personality: {
                        goals: [{ id: 'g-bootstrap', description: draft.goal, priority: 'medium' }],
                    },
                });
                entity = result.entity;
                reused = result.reused;
            } catch {
                entity = await createNpcEntity({
                    displayName: draft.displayName,
                    description: draft.description,
                    stats: sheet.worldStats as unknown as Record<string, unknown>,
                    personality: {
                        goals: [{ id: 'g-bootstrap', description: draft.goal, priority: 'medium' }],
                    },
                    createdByUserId: opts.userId ?? null,
                    entityTier: draft.tier,
                });
            }
        }

        const row = await repo.findOne({ where: { id: entity.id } });
        if (row) {
            const existing = row.stats as NpcWorldStats | Record<string, unknown>;
            if (!existing.srdBuild || opts.alwaysCreate) {
                row.stats = sheet.worldStats as unknown as Record<string, unknown>;
            }
            row.description = draft.description.slice(0, 500);
            row.displayName = draft.displayName;
            await repo.save(row);
            entity = row;
        }

        const cast = npcCastFromEntity(entity);
        results.push({
            entityId: entity.id,
            displayName: entity.displayName,
            givenName: cast.givenName,
            roleTitle: cast.roleTitle,
            level: cast.level,
            vida: cast.vida,
            vidaMax: cast.vidaMax,
            role: cast.role,
            reused,
        });
    }

    return results;
}

async function seedCanonNpcBatch(opts: {
    regionSlug: string;
    regionName: string;
    batchSize: number;
    heroLevel: number;
    mode: CanonNpcSeedMode;
    userId?: number;
    alwaysCreate?: boolean;
    dryRun?: boolean;
    sessionId?: number;
    userApiKey?: string;
    reserved: Set<string>;
    factionNames: string[];
    nameOffset?: number;
}): Promise<CanonNpcSeedRow[]> {
    const batchSize = Math.max(1, Math.min(opts.mode === 'server' ? 20 : CANON_NPC_BATCH_SIZE, opts.batchSize));

    let drafts: BootstrapNpcDraft[];
    if (opts.mode === 'server') {
        drafts = generateServerCanonNpcDrafts({
            count: batchSize,
            regionSlug: opts.regionSlug,
            regionName: opts.regionName,
            heroLevel: opts.heroLevel,
            reserved: opts.reserved,
            nameOffset: opts.nameOffset,
        });
    } else {
        const gen = await generateBootstrapNpcs({
            sessionId: opts.sessionId ?? 0,
            userId: opts.userId ?? 0,
            regionSlug: opts.regionSlug,
            regionName: opts.regionName,
            factionNames: opts.factionNames,
            npcCount: batchSize,
            uniqueNames: true,
            reservedGivenNames: [...opts.reserved],
            userApiKey: opts.userApiKey,
        });
        drafts = dedupeNpcDrafts(gen.npcs, opts.reserved, opts.regionSlug);
        if (drafts.length !== batchSize) {
            throw new Error(
                `[${opts.regionSlug}] dedupe reduziu lote para ${drafts.length}/${batchSize} NPCs`,
            );
        }
    }

    if (opts.dryRun) {
        return drafts.map(d => {
            const sheet = buildNpcCombatSheetForDraft(d, opts.heroLevel, opts.regionSlug);
            return formatCanonNpcSeedRow(d, sheet, 'dry-run', false);
        });
    }

    const materialized = await materializeCanonicalNpcs({
        regionSlug: opts.regionSlug,
        npcs: drafts,
        heroLevel: opts.heroLevel,
        userId: opts.userId,
        alwaysCreate: opts.alwaysCreate ?? true,
    });

    const rows: CanonNpcSeedRow[] = [];
    for (let i = 0; i < drafts.length; i++) {
        const draft = drafts[i]!;
        const sheet = buildNpcCombatSheetForDraft(draft, opts.heroLevel, opts.regionSlug);
        const mat = materialized[i];
        rows.push(
            formatCanonNpcSeedRow(draft, sheet, mat?.entityId ?? 'unknown', mat?.reused ?? false),
        );
    }
    return rows;
}

export async function seedCanonicalNpcsForRegion(opts: {
    regionSlug: string;
    npcCount?: number;
    heroLevel?: number;
    userId?: number;
    alwaysCreate?: boolean;
    dryRun?: boolean;
    sessionId?: number;
    userApiKey?: string;
    /** Nomes já usados (ex.: seed --all acumula entre regiões). */
    reservedNames?: Set<string>;
    /** Adiciona um lote mesmo acima do alvo (não substitui existentes). */
    force?: boolean;
    /** Aposenta NPCs atuais da região e recria até o alvo. */
    replaceRegion?: boolean;
    /** Limita lotes nesta execução (ex.: 1 = só preenche até 5 NPCs por vez). */
    maxBatches?: number;
    /** `server` = ficha SRD local (seed em massa); `gemini` = IA. */
    seedMode?: CanonNpcSeedMode;
}): Promise<CanonicalNpcSeedResult> {
    const seedMode = opts.seedMode ?? 'server';
    const targetTotal = resolveCanonNpcTarget(opts.npcCount);
    const heroLevel = Math.max(1, Math.min(20, opts.heroLevel ?? 3));
    const regionMeta = await getRegionBySlug(opts.regionSlug);
    if (!regionMeta) {
        throw new Error(`Região canônica não encontrada: ${opts.regionSlug}`);
    }
    const regionName = regionMeta.displayName;

    if (opts.replaceRegion && !opts.dryRun) {
        const retired = await retireCanonNpcsInRegion(opts.regionSlug);
        if (retired > 0) {
            console.log(`  ↻ ${opts.regionSlug}: ${retired} NPCs aposentados antes do re-seed`);
        }
    }

    let existingCount = await countCanonNpcsInRegion(opts.regionSlug);

    if (!opts.force && !opts.replaceRegion && !opts.dryRun && existingCount >= targetTotal) {
        return {
            regionSlug: opts.regionSlug,
            regionName,
            targetTotal,
            requested: 0,
            created: 0,
            reused: 0,
            skipped: targetTotal,
            batches: 0,
            source: 'skipped',
            npcs: [],
        };
    }

    const factionNames = findFactionsByRegionSlug(opts.regionSlug).map(f => f.displayName);
    const reserved =
        opts.reservedNames ?? (await loadReservedNpcGivenNames());

    const allRows: CanonNpcSeedRow[] = [];
    let batches = 0;
    let created = 0;
    let reused = 0;
    const batchCap = seedMode === 'server' ? 20 : CANON_NPC_BATCH_SIZE;
    let nameOffset = 0;

    while (true) {
        const gap = targetTotal - existingCount;
        const batchSize = opts.force
            ? Math.min(batchCap, targetTotal)
            : Math.min(batchCap, gap);

        if (batchSize <= 0) break;
        if (opts.force && batches > 0) break;
        if (opts.maxBatches != null && batches >= opts.maxBatches) break;

        batches += 1;
        const rows = await seedCanonNpcBatch({
            regionSlug: opts.regionSlug,
            regionName,
            batchSize,
            heroLevel,
            mode: seedMode,
            userId: opts.userId,
            alwaysCreate: opts.alwaysCreate,
            dryRun: opts.dryRun,
            sessionId: opts.sessionId,
            userApiKey: opts.userApiKey,
            reserved,
            factionNames,
            nameOffset: seedMode === 'server' ? nameOffset : undefined,
        });
        if (seedMode === 'server') nameOffset += batchSize;
        allRows.push(...rows);
        created += rows.filter(r => !r.reused).length;
        reused += rows.filter(r => r.reused).length;

        if (opts.dryRun) break;

        existingCount = await countCanonNpcsInRegion(opts.regionSlug);
        if (opts.force) break;
        if (existingCount >= targetTotal) break;
    }

    if (allRows.length === 0 && !opts.dryRun) {
        return {
            regionSlug: opts.regionSlug,
            regionName,
            targetTotal,
            requested: 0,
            created: 0,
            reused: 0,
            skipped: targetTotal,
            batches: 0,
            source: 'skipped',
            npcs: [],
        };
    }

    return {
        regionSlug: opts.regionSlug,
        regionName,
        targetTotal,
        requested: allRows.length,
        created,
        reused,
        skipped: Math.max(0, targetTotal - (opts.dryRun ? 0 : await countCanonNpcsInRegion(opts.regionSlug))),
        batches,
        source: seedMode,
        npcs: allRows,
    };
}

export async function listCanonicalRegionSlugs(): Promise<string[]> {
    const rows = await PenaiDataSource.getRepository(CanonicalRegion).find({
        order: { displayName: 'ASC' },
    });
    return rows.map(r => r.slug);
}
