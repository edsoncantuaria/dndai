import { PenaiDataSource } from '../database/data-source.js';
import { CanonicalRegion } from '../database/entities/CanonicalRegion.js';
import { CanonicalRegionLink } from '../database/entities/CanonicalRegionLink.js';
import { getRegionBySlug } from './travelCanon.js';

/** Regiões vizinhas alcançáveis (não bloqueadas) para seed de missões de viagem. */
export async function listNeighborRegionSlugs(
    fromSlug: string,
    limit = 3,
): Promise<Array<{ slug: string; displayName: string }>> {
    const from = await getRegionBySlug(fromSlug);
    if (!from) return [];

    const linkRepo = PenaiDataSource.getRepository(CanonicalRegionLink);
    const regionRepo = PenaiDataSource.getRepository(CanonicalRegion);
    const links = await linkRepo
        .createQueryBuilder('l')
        .where('l.fromRegionId = :id OR l.toRegionId = :id', { id: from.id })
        .andWhere('l.isLocked = false')
        .take(12)
        .getMany();

    const out: Array<{ slug: string; displayName: string }> = [];
    const seen = new Set<string>([from.slug]);

    for (const link of links) {
        const otherId = link.fromRegionId === from.id ? link.toRegionId : link.fromRegionId;
        const other = await regionRepo.findOne({ where: { id: otherId } });
        if (!other || seen.has(other.slug)) continue;
        seen.add(other.slug);
        out.push({ slug: other.slug, displayName: other.displayName });
        if (out.length >= limit) break;
    }

    return out;
}
