import regionGraph from '../../data/regionsSeed.json' with { type: 'json' };
import type { RegionGraphPayload } from '../../schemas/regionSchemas.js';
import { PenaiDataSource } from '../database/data-source.js';
import { CanonicalPoi } from '../database/entities/CanonicalPoi.js';
import { listSessionWorldEvents } from '../events/store.js';

const graph = regionGraph as RegionGraphPayload;

const slugify = (value: string): string =>
    value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const seedRegionBySlug = new Map(
    graph.regions.map(r => [slugify(r.slug || r.name), r]),
);

const seedPoiBySlug = new Map(
    (graph.pointsOfInterest ?? []).map(poi => [slugify(poi.slug), poi]),
);

export type AmbientLocationContext = {
    regionSlug: string | null;
    regionType: string | null;
    poiSlug: string | null;
    poiName: string | null;
    environmentTags: string[];
};

function climateTags(climate: unknown): string[] {
    if (typeof climate !== 'string') return [];
    const normalized = climate.toLowerCase();
    if (normalized.includes('marit')) return ['oceano', 'agua', 'porto', 'costa'];
    if (normalized.includes('montanh')) return ['montanha', 'vento'];
    if (normalized.includes('desert') || normalized.includes('arid')) return ['deserto', 'areia'];
    if (normalized.includes('gel') || normalized.includes('fri')) return ['gelo', 'neve', 'inverno', 'frio'];
    if (normalized.includes('selv') || normalized.includes('tropical')) return ['selva', 'floresta', 'natureza'];
    return [];
}

function poiSeedTags(poiSeed: (typeof graph.pointsOfInterest)[number] | undefined): string[] {
    if (!poiSeed) return [];
    const tags: string[] = [];
    const poiType = slugify(poiSeed.type ?? '');
    if (poiType.includes('dungeon')) tags.push('caverna', 'masmorra', 'subterraneo');
    if (poiType.includes('temple')) tags.push('templo', 'sagrado');
    if (poiType.includes('shop')) tags.push('cidade', 'interior');

    const category = (poiSeed.metadata as { category?: string } | undefined)?.category;
    if (category === 'inn') tags.push('taverna', 'social', 'interior');
    if (category === 'forge' || category === 'blacksmith') tags.push('forja', 'cidade');

    const metaTags = (poiSeed.metadata as { tags?: string[] } | undefined)?.tags;
    if (Array.isArray(metaTags)) {
        metaTags.forEach(tag => tags.push(slugify(tag)));
    }

    return tags;
}

async function resolveCurrentPoiSlug(
    sessionId: number,
    regionSlug: string,
): Promise<string | null> {
    const normalizedRegion = slugify(regionSlug);
    const events = await listSessionWorldEvents(sessionId, 100);
    for (const event of events) {
        if (event.type !== 'TRAVEL_COMPLETED') continue;
        const eventRegion = event.payload.regionSlug;
        const targetPoi = event.payload.targetPoiSlug;
        if (
            typeof eventRegion === 'string' &&
            slugify(eventRegion) === normalizedRegion &&
            typeof targetPoi === 'string' &&
            targetPoi.trim()
        ) {
            return slugify(targetPoi);
        }
    }

    const seedRegion = seedRegionBySlug.get(normalizedRegion);
    const defaultPoi = (seedRegion?.metadata as { defaultSpawnPoi?: string } | undefined)
        ?.defaultSpawnPoi;
    return typeof defaultPoi === 'string' && defaultPoi.trim() ? slugify(defaultPoi) : null;
}

export async function resolveAmbientLocationContext(
    sessionId: number,
    regionSlug: string | null,
): Promise<AmbientLocationContext> {
    if (!regionSlug) {
        return {
            regionSlug: null,
            regionType: null,
            poiSlug: null,
            poiName: null,
            environmentTags: [],
        };
    }

    const normalizedRegion = slugify(regionSlug);
    const seedRegion = seedRegionBySlug.get(normalizedRegion);
    const regionType = seedRegion?.type ?? null;
    const environmentTags = new Set<string>();

    if (regionType) environmentTags.add(regionType);
    climateTags((seedRegion?.metadata as { climate?: string } | undefined)?.climate).forEach(tag =>
        environmentTags.add(tag),
    );

    if (seedRegion?.name) {
        slugify(seedRegion.name)
            .split('-')
            .filter(Boolean)
            .forEach(token => environmentTags.add(token));
    }

    const poiSlug = await resolveCurrentPoiSlug(sessionId, normalizedRegion);
    let poiName: string | null = null;

    if (poiSlug) {
        const poiSeed = seedPoiBySlug.get(poiSlug);
        poiName = poiSeed?.name ?? null;
        poiSeedTags(poiSeed).forEach(tag => environmentTags.add(tag));

        if (!poiName) {
            const regionEntity = seedRegion
                ? await PenaiDataSource.getRepository(
                      (await import('../database/entities/CanonicalRegion.js')).CanonicalRegion,
                  ).findOne({ where: { slug: normalizedRegion } })
                : null;
            if (regionEntity) {
                const poiRow = await PenaiDataSource.getRepository(CanonicalPoi).findOne({
                    where: { regionId: regionEntity.id, slug: poiSlug },
                });
                poiName = poiRow?.displayName ?? null;
                if (poiRow?.poiType) {
                    const poiType = slugify(poiRow.poiType);
                    if (poiType.includes('dungeon')) {
                        environmentTags.add('caverna');
                        environmentTags.add('masmorra');
                        environmentTags.add('subterraneo');
                    }
                    if (poiType.includes('temple')) {
                        environmentTags.add('templo');
                        environmentTags.add('sagrado');
                    }
                    if (poiType.includes('shop')) environmentTags.add('cidade');
                }
            }
        }
    }

    return {
        regionSlug: normalizedRegion,
        regionType,
        poiSlug,
        poiName,
        environmentTags: Array.from(environmentTags),
    };
}
