import regionGraph from '../../data/regionsSeed.json' with { type: 'json' };
import type { RegionGraphPayload } from '../../schemas/regionSchemas.js';
import { getRegionBySlug } from './travelCanon.js';

const graph = regionGraph as RegionGraphPayload;

export type SpawnTier = 'intro' | 'capital';

const slugify = (value: string): string =>
    value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

/** Cidades marcadas com `isSpawnPool` no regionsSeed.json. */
export function listSpawnPoolSlugs(tier?: SpawnTier): string[] {
    return graph.regions
        .filter(entry => entry.type === 'city' && entry.isSpawnPool)
        .filter(entry => {
            if (!tier) return true;
            const profile = (entry.metadata as { spawnTier?: string } | undefined)?.spawnTier;
            return profile === tier;
        })
        .map(entry => slugify(entry.slug || entry.name))
        .filter(Boolean);
}

export function pickRandomSpawnSlug(tier: SpawnTier = 'intro'): string {
    const pool = listSpawnPoolSlugs(tier);
    if (!pool.length) {
        const fallback = listSpawnPoolSlugs();
        if (fallback.length) {
            return fallback[Math.floor(Math.random() * fallback.length)];
        }
        return 'cidadela-do-aco-luz';
    }
    return pool[Math.floor(Math.random() * pool.length)];
}

/** Valida slug contra o pool; se inválido, sorteia no tier intro. */
export async function resolveSessionSpawnSlug(requested?: string | null): Promise<{
    slug: string;
    displayName: string;
    tier: SpawnTier;
    fromPool: boolean;
}> {
    const pool = listSpawnPoolSlugs();
    const introPool = listSpawnPoolSlugs('intro');
    const normalized = requested ? slugify(requested) : '';

    let slug = normalized;
    let tier: SpawnTier = 'intro';

    if (slug && pool.includes(slug)) {
        const entry = graph.regions.find(r => slugify(r.slug || r.name) === slug);
        const profile = (entry?.metadata as { spawnTier?: string } | undefined)?.spawnTier;
        tier = profile === 'capital' ? 'capital' : 'intro';
    } else {
        slug = pickRandomSpawnSlug('intro');
        tier = introPool.includes(slug) ? 'intro' : 'capital';
    }

    const region = await getRegionBySlug(slug);
    return {
        slug,
        displayName: region?.displayName ?? slug,
        tier,
        fromPool: Boolean(normalized && pool.includes(normalized)),
    };
}

export function describeSpawnPool(): Array<{ slug: string; name: string; tier: SpawnTier; levelRange?: string }> {
    return graph.regions
        .filter(entry => entry.type === 'city' && entry.isSpawnPool)
        .map(entry => ({
            slug: slugify(entry.slug || entry.name),
            name: entry.name,
            tier: ((entry.metadata as { spawnTier?: string })?.spawnTier === 'capital'
                ? 'capital'
                : 'intro') as SpawnTier,
            levelRange: (entry.metadata as { levelRange?: string })?.levelRange,
        }));
}
