import { PenaiDataSource } from '../database/data-source.js';
import { CanonicalRegion } from '../database/entities/CanonicalRegion.js';
import { CanonicalPoi } from '../database/entities/CanonicalPoi.js';

export async function listCanonicalRegions(): Promise<
    Array<{ slug: string; displayName: string; pois: Array<{ slug: string; displayName: string }> }>
> {
    const regions = await PenaiDataSource.getRepository(CanonicalRegion).find();
    const pois = await PenaiDataSource.getRepository(CanonicalPoi).find();
    return regions.map(r => ({
        slug: r.slug,
        displayName: r.displayName,
        pois: pois.filter(p => p.regionId === r.id).map(p => ({
            slug: p.slug,
            displayName: p.displayName,
        })),
    }));
}

export async function getPoiBySlug(
    regionSlug: string,
    poiSlug: string,
): Promise<CanonicalPoi | null> {
    const region = await PenaiDataSource.getRepository(CanonicalRegion).findOne({
        where: { slug: regionSlug },
    });
    if (!region) return null;
    return PenaiDataSource.getRepository(CanonicalPoi).findOne({
        where: { regionId: region.id, slug: poiSlug },
    });
}
