import { randomUUID } from 'crypto';
import { PenaiDataSource } from '../data-source.js';
import { CanonicalPoi } from '../entities/CanonicalPoi.js';
import { WorldEntity } from '../entities/WorldEntity.js';
import { importRegionGraphToPenai } from './importRegionGraphToPenai.js';

export async function seedPenaiWorld(): Promise<void> {
    const force = process.env.PENAI_WORLD_SEED_FORCE === 'true';
    const stats = await importRegionGraphToPenai({ force });
    if (stats.regions === 0) return;

    const { ensureFactionCatalogInDatabase } = await import('../../world/factionSeed.js');
    await ensureFactionCatalogInDatabase();

    const { seedFactionNotableNpcs } = await import('./seedFactionNpcs.js');
    await seedFactionNotableNpcs();

    const poiRepo = PenaiDataSource.getRepository(CanonicalPoi);
    await seedAmbientCanonNpcs(poiRepo);
}

/** NPCs de ambiente (taverna, etc.) fora do catálogo de facções */
async function seedAmbientCanonNpcs(
    poiRepo: ReturnType<typeof PenaiDataSource.getRepository<CanonicalPoi>>,
): Promise<void> {
    const entityRepo = PenaiDataSource.getRepository(WorldEntity);
    const taverna =
        (await poiRepo.findOne({ where: { slug: 'taverna-dragao-azul' } })) ??
        (await poiRepo.findOne({ where: { slug: 'taverna-lua-rubra' } }));

    const ambient = [
        {
            slug: 'mira-dona-taverna',
            displayName: 'Mira, Dona da Taverna',
            poiId: taverna?.id ?? null,
            personality: { planner: 'goap', goals: [{ id: 'serve-tavern', label: 'Gerir a taverna' }] },
        },
    ];

    for (const npc of ambient) {
        const found = await entityRepo.findOne({ where: { slug: npc.slug } });
        if (found) continue;
        await entityRepo.save(
            entityRepo.create({
                id: randomUUID(),
                entityType: 'npc',
                entityTier: 'MAJOR',
                canonical: true,
                slug: npc.slug,
                displayName: npc.displayName,
                description: null,
                stats: { level: 4 },
                personality: npc.personality,
                visual: {},
                poiId: npc.poiId,
                source: 'admin',
                locale: 'pt-BR',
            }),
        );
    }
}

