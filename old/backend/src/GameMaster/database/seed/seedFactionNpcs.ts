import { randomUUID } from 'crypto';
import { PenaiDataSource } from '../data-source.js';
import { CanonicalPoi } from '../entities/CanonicalPoi.js';
import { WorldEntity } from '../entities/WorldEntity.js';
import { FACTION_CATALOG } from '../../world/factionCatalog.js';

/** Sincroniza NPCs notáveis das facções (por slug; idempotente). */
export async function seedFactionNotableNpcs(): Promise<void> {
    const poiRepo = PenaiDataSource.getRepository(CanonicalPoi);
    const entityRepo = PenaiDataSource.getRepository(WorldEntity);

    for (const faction of FACTION_CATALOG) {
        for (const npc of faction.notableNpcs ?? []) {
            const poi = await poiRepo.findOne({ where: { slug: npc.poiSlug } });
            const existing = await entityRepo.findOne({ where: { slug: npc.slug } });
            if (existing) {
                if (poi && existing.poiId !== poi.id) {
                    existing.poiId = poi.id;
                    await entityRepo.save(existing);
                }
                continue;
            }
            await entityRepo.save(
                entityRepo.create({
                    id: randomUUID(),
                    entityType: 'npc',
                    entityTier: 'MAJOR',
                    canonical: true,
                    slug: npc.slug,
                    displayName: npc.displayName,
                    description: `${npc.title} — ${faction.displayName}`,
                    stats: { level: 6, factionSlug: faction.slug },
                    personality: {
                        planner: 'goap',
                        factionSlug: faction.slug,
                        goals: [{ id: `faction-${faction.slug}`, label: npc.title }],
                    },
                    visual: {},
                    poiId: poi?.id ?? null,
                    source: 'admin',
                    locale: 'pt-BR',
                }),
            );
        }
    }
}
