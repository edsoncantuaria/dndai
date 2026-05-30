import { PenaiDataSource } from '../database/data-source.js';
import { SessionRegionState } from '../database/entities/SessionRegionState.js';
import { SessionRegionEconomy } from '../database/entities/SessionRegionEconomy.js';
import { SessionFactionInfluence } from '../database/entities/SessionFactionInfluence.js';
import { SessionEntityReputation } from '../database/entities/SessionEntityReputation.js';

const DEFAULT_RESOURCES: Record<string, number> = {
    wolfStock: 40,
    grainSupply: 60,
};

export async function getOrCreateRegionState(
    sessionId: number,
    regionSlug: string,
): Promise<SessionRegionState> {
    const repo = PenaiDataSource.getRepository(SessionRegionState);
    let row = await repo.findOne({ where: { sessionId, regionSlug } });
    if (!row) {
        row = repo.create({
            sessionId,
            regionSlug,
            fear: 20,
            prosperity: 50,
            crime: 30,
            resources: { ...DEFAULT_RESOURCES },
        });
        await repo.save(row);
    }
    return row;
}

export async function adjustRegionResource(
    sessionId: number,
    regionSlug: string,
    resourceKey: string,
    delta: number,
): Promise<SessionRegionState> {
    const row = await getOrCreateRegionState(sessionId, regionSlug);
    const resources = { ...(row.resources ?? {}) };
    resources[resourceKey] = Math.max(0, (resources[resourceKey] ?? 0) + delta);
    row.resources = resources;
    if (resourceKey === 'wolfStock' && delta < 0) {
        row.prosperity = Math.min(100, row.prosperity + 2);
        row.fear = Math.max(0, row.fear - 1);
    }
    await PenaiDataSource.getRepository(SessionRegionState).save(row);
    return row;
}

export async function getOrCreateEconomyRow(
    sessionId: number,
    regionSlug: string,
    itemSlug: string,
): Promise<SessionRegionEconomy> {
    const repo = PenaiDataSource.getRepository(SessionRegionEconomy);
    let row = await repo.findOne({ where: { sessionId, regionSlug, itemSlug } });
    if (!row) {
        row = repo.create({
            sessionId,
            regionSlug,
            itemSlug,
            basePrice: 10,
            currentPrice: 10,
            scarcity: 0,
        });
        await repo.save(row);
    }
    return row;
}

export async function applyScarcityToPrice(
    sessionId: number,
    regionSlug: string,
    itemSlug: string,
    scarcityDelta: number,
): Promise<SessionRegionEconomy> {
    const row = await getOrCreateEconomyRow(sessionId, regionSlug, itemSlug);
    row.scarcity = Math.max(0, Math.min(100, row.scarcity + scarcityDelta));
    row.currentPrice = row.basePrice * (1 + row.scarcity / 100);
    await PenaiDataSource.getRepository(SessionRegionEconomy).save(row);
    return row;
}

export async function adjustFactionInfluence(
    sessionId: number,
    factionSlug: string,
    regionSlug: string,
    delta: number,
): Promise<SessionFactionInfluence> {
    const repo = PenaiDataSource.getRepository(SessionFactionInfluence);
    let row = await repo.findOne({ where: { sessionId, factionSlug, regionSlug } });
    if (!row) {
        row = repo.create({ sessionId, factionSlug, regionSlug, influence: 0 });
    }
    row.influence = Math.max(0, Math.min(100, row.influence + delta));
    await repo.save(row);
    return row;
}

export async function adjustEntityReputation(
    sessionId: number,
    worldEntityId: string,
    targetSlug: string,
    delta: number,
): Promise<SessionEntityReputation> {
    const repo = PenaiDataSource.getRepository(SessionEntityReputation);
    let row = await repo.findOne({ where: { sessionId, worldEntityId, targetSlug } });
    if (!row) {
        row = repo.create({ sessionId, worldEntityId, targetSlug, score: 0 });
    }
    row.score = Math.max(-100, Math.min(100, row.score + delta));
    await repo.save(row);
    return row;
}

export async function listTopReputations(
    sessionId: number,
    worldEntityId: string,
    limit = 5,
): Promise<Array<{ targetSlug: string; score: number }>> {
    const rows = await PenaiDataSource.getRepository(SessionEntityReputation).find({
        where: { sessionId, worldEntityId },
        order: { score: 'DESC' },
        take: limit,
    });
    return rows.map(r => ({ targetSlug: r.targetSlug, score: r.score }));
}
