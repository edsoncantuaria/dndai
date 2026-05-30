import { randomUUID } from 'crypto';
import regionGraph from '../../../data/regionsSeed.json' with { type: 'json' };
import type { RegionGraphPayload } from '../../../schemas/regionSchemas.js';
import { PenaiDataSource } from '../data-source.js';
import { CanonicalRegion } from '../entities/CanonicalRegion.js';
import { CanonicalPoi } from '../entities/CanonicalPoi.js';
import { CanonicalRegionLink } from '../entities/CanonicalRegionLink.js';
import { TravelModeCatalog } from '../entities/TravelModeCatalog.js';
import { WorldEntity } from '../entities/WorldEntity.js';

const graph = regionGraph as RegionGraphPayload;

const slugify = (value: string): string =>
    value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

/** km/h efetivo para estimar distância a partir do tempo do grafo legado. */
const MODE_KMH: Record<string, number> = {
    walk: 5,
    mount: 12,
    horse: 12,
    ship: 18,
    airship: 90,
    portal: 200,
    teleport: 200,
};

function estimateDistanceKm(travelMode: string, travelTimeMinutes: number): number {
    const hours = Math.max(travelTimeMinutes, 5) / 60;
    const kmh = MODE_KMH[travelMode] ?? MODE_KMH.walk;
    return Math.round(Math.max(3, hours * kmh) * 10) / 10;
}

async function seedTravelModes(
    modeRepo: ReturnType<typeof PenaiDataSource.getRepository<TravelModeCatalog>>,
): Promise<void> {
    const modes = [
        { slug: 'walk', displayName: 'A pé', speedMultiplier: 1 },
        { slug: 'mount', displayName: 'Montaria', speedMultiplier: 2 },
        { slug: 'horse', displayName: 'Cavalo', speedMultiplier: 2 },
        { slug: 'wagon', displayName: 'Carroça', speedMultiplier: 1.5 },
        { slug: 'ship', displayName: 'Navio', speedMultiplier: 2.5 },
        { slug: 'airship', displayName: 'Aeronave', speedMultiplier: 6 },
        { slug: 'portal', displayName: 'Portal', speedMultiplier: 12 },
        { slug: 'teleport', displayName: 'Teleporte', speedMultiplier: 12 },
        { slug: 'dragon', displayName: 'Dragão', speedMultiplier: 8 },
    ];
    for (const m of modes) {
        const exists = await modeRepo.findOne({ where: { slug: m.slug } });
        if (!exists) {
            await modeRepo.save(modeRepo.create({ ...m, locale: 'pt-BR' }));
        }
    }
}

async function clearPenaiWorld(): Promise<void> {
    await PenaiDataSource.getRepository(WorldEntity)
        .createQueryBuilder()
        .update()
        .set({ poiId: null })
        .where('poiId IS NOT NULL')
        .execute();
    await PenaiDataSource.query(
        'TRUNCATE TABLE canonical_region_links, canonical_pois, canonical_regions RESTART IDENTITY CASCADE',
    );
}

/**
 * Importa `regionsSeed.json` para canonical_regions / pois / links (PostgreSQL PENAI).
 */
export async function importRegionGraphToPenai(options?: {
    force?: boolean;
    graph?: RegionGraphPayload;
}): Promise<{ regions: number; pois: number; links: number }> {
    const payload = options?.graph ?? graph;
    const regionRepo = PenaiDataSource.getRepository(CanonicalRegion);
    const poiRepo = PenaiDataSource.getRepository(CanonicalPoi);
    const linkRepo = PenaiDataSource.getRepository(CanonicalRegionLink);
    const modeRepo = PenaiDataSource.getRepository(TravelModeCatalog);

    const existing = await regionRepo.count();
    if (existing > 0 && !options?.force) {
        await seedTravelModes(modeRepo);
        console.log(
            '[PENAI] Mundo canônico já existe (%d regiões). Use PENAI_WORLD_SEED_FORCE=true ou --force para reimportar Aurathis.',
            existing,
        );
        return { regions: existing, pois: await poiRepo.count(), links: await linkRepo.count() };
    }

    if (options?.force && existing > 0) {
        console.log('[PENAI] PENAI_WORLD_SEED_FORCE — limpando mundo canônico…');
        await clearPenaiWorld();
    }

    const regionIdBySlug = new Map<string, string>();

    for (const entry of payload.regions) {
        const slug = slugify(entry.slug || entry.name);
        if (!slug) continue;
        const id = randomUUID();
        regionIdBySlug.set(slug, id);
        const meta = entry.metadata as Record<string, unknown> | undefined;
        const ruler = meta?.ruler as { name?: string; title?: string } | undefined;
        let summary = entry.summary ?? null;
        if (ruler?.name && summary) {
            summary = `${summary} Soberano: ${ruler.name}${ruler.title ? ` (${ruler.title})` : ''}.`;
        } else if (ruler?.name) {
            summary = `Soberano: ${ruler.name}${ruler.title ? ` (${ruler.title})` : ''}.`;
        }
        await regionRepo.save(
            regionRepo.create({
                id,
                slug,
                displayName: entry.name,
                summary,
                locale: 'pt-BR',
            }),
        );
    }

    let poiCount = 0;
    for (const poi of payload.pois ?? []) {
        const regionSlug = slugify(poi.regionSlug);
        const regionId = regionIdBySlug.get(regionSlug);
        if (!regionId) continue;
        const slug = slugify(poi.slug || poi.name);
        if (!slug) continue;
        await poiRepo.save(
            poiRepo.create({
                id: randomUUID(),
                regionId,
                slug,
                displayName: poi.name,
                poiType: poi.type ?? 'landmark',
                maxImportantNpcs: 5,
                description: poi.summary ?? poi.description ?? null,
                locale: 'pt-BR',
            }),
        );
        poiCount += 1;
    }

    let linkCount = 0;
    for (const link of payload.links ?? []) {
        const fromSlug = slugify(link.fromSlug);
        const toSlug = slugify(link.toSlug);
        const fromId = regionIdBySlug.get(fromSlug);
        const toId = regionIdBySlug.get(toSlug);
        if (!fromId || !toId) continue;
        const travelMode = link.travelMode ?? 'walk';
        const travelTimeMinutes = link.travelTimeMinutes ?? 60;
        await linkRepo.save(
            linkRepo.create({
                id: randomUUID(),
                fromRegionId: fromId,
                toRegionId: toId,
                distanceKm: estimateDistanceKm(travelMode, travelTimeMinutes),
                baseDurationHours: Math.round((travelTimeMinutes / 60) * 10) / 10,
                biome: link.difficulty ?? link.notes?.slice(0, 64) ?? null,
                terrainModifier: link.difficulty === 'alta' ? 1.4 : link.difficulty === 'média' ? 1.15 : 1,
                isLocked: link.isLocked ?? false,
                locale: 'pt-BR',
            }),
        );
        linkCount += 1;
    }

    await seedTravelModes(modeRepo);

    console.log(
        '[PENAI] Aurathis importado: %d regiões, %d POIs, %d rotas.',
        regionIdBySlug.size,
        poiCount,
        linkCount,
    );
    return { regions: regionIdBySlug.size, pois: poiCount, links: linkCount };
}
