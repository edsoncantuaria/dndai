import { PenaiDataSource } from '../database/data-source.js';
import { SessionFactionDiscovery } from '../database/entities/SessionFactionDiscovery.js';
import { Faction } from '../database/entities/Faction.js';
import {
    findFactionsByPoiSlug,
    findFactionsByRegionSlug,
    getFactionCatalogEntry,
    isCatalogFaction,
} from './factionCatalog.js';

export async function discoverFaction(
    sessionId: number,
    factionSlug: string,
    source: string,
): Promise<boolean> {
    if (!isCatalogFaction(factionSlug)) {
        return false;
    }
    const repo = PenaiDataSource.getRepository(SessionFactionDiscovery);
    const exists = await repo.findOne({ where: { sessionId, factionSlug } });
    if (exists) return false;
    await repo.save(repo.create({ sessionId, factionSlug, source }));
    return true;
}

export async function discoverFactionsByPoi(
    sessionId: number,
    poiSlug: string,
): Promise<string[]> {
    const discovered: string[] = [];
    for (const entry of findFactionsByPoiSlug(poiSlug)) {
        const ok = await discoverFaction(sessionId, entry.slug, `poi:${poiSlug}`);
        if (ok) discovered.push(entry.slug);
    }
    return discovered;
}

/** Revela facções com sede ou capítulo na região (viagem sem POI explícito). */
export async function discoverFactionsByRegion(
    sessionId: number,
    regionSlug: string,
): Promise<string[]> {
    const discovered: string[] = [];
    for (const entry of findFactionsByRegionSlug(regionSlug)) {
        const ok = await discoverFaction(sessionId, entry.slug, `region:${regionSlug}`);
        if (ok) discovered.push(entry.slug);
    }
    return discovered;
}

export async function listDiscoveredFactions(
    sessionId: number,
): Promise<Array<{ factionSlug: string; discoveredAt: Date; source: string }>> {
    const rows = await PenaiDataSource.getRepository(SessionFactionDiscovery).find({
        where: { sessionId },
        order: { discoveredAt: 'ASC' },
    });
    return rows.map(r => ({
        factionSlug: r.factionSlug,
        discoveredAt: r.discoveredAt,
        source: r.source,
    }));
}

export async function resolveFactionDisplayName(factionSlug: string): Promise<string> {
    const catalog = getFactionCatalogEntry(factionSlug);
    if (catalog) return catalog.displayName;
    const row = await PenaiDataSource.getRepository(Faction).findOne({ where: { slug: factionSlug } });
    return row?.displayName ?? factionSlug.replace(/-/g, ' ');
}
