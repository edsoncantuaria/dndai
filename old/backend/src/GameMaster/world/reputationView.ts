import { PenaiDataSource } from '../database/data-source.js';
import { SessionEntityReputation } from '../database/entities/SessionEntityReputation.js';
import { getRegionBySlug } from './travelCanon.js';
import { listDiscoveredFactions, resolveFactionDisplayName } from './factionDiscovery.js';
import { getFactionCatalogEntry } from './factionCatalog.js';
import { scoreToReputationTier, type ReputationTierId } from './reputationTiers.js';

export const regionReputationKey = (regionSlug: string) => `region:${regionSlug}`;
export const factionReputationKey = (factionSlug: string) => `faction:${factionSlug}`;

export type ReputationRowView = {
    targetSlug: string;
    score: number;
    tierId: ReputationTierId;
    tierLabel: string;
};

export type RegionReputationView = ReputationRowView & {
    regionSlug: string;
    displayName: string;
};

export type FactionReputationView = ReputationRowView & {
    factionSlug: string;
    displayName: string;
    archetype: string;
    discoveredAt: string;
};

export type HeroReputationView = {
    region: RegionReputationView | null;
    factions: FactionReputationView[];
};

async function readEntityScore(
    sessionId: number,
    worldEntityId: string,
    ...keys: string[]
): Promise<number> {
    const repo = PenaiDataSource.getRepository(SessionEntityReputation);
    for (const key of keys) {
        const row = await repo.findOne({ where: { sessionId, worldEntityId, targetSlug: key } });
        if (row) return row.score;
    }
    return 0;
}

function toRowView(targetSlug: string, score: number): ReputationRowView {
    const tier = scoreToReputationTier(score);
    return {
        targetSlug,
        score,
        tierId: tier.id,
        tierLabel: tier.label,
    };
}

export async function loadHeroReputationView(
    sessionId: number,
    worldEntityId: string,
    currentRegionSlug: string | null,
): Promise<HeroReputationView> {
    let region: RegionReputationView | null = null;
    if (currentRegionSlug) {
        const score = await readEntityScore(
            sessionId,
            worldEntityId,
            regionReputationKey(currentRegionSlug),
            currentRegionSlug,
        );
        const canon = await getRegionBySlug(currentRegionSlug);
        const base = toRowView(regionReputationKey(currentRegionSlug), score);
        region = {
            ...base,
            regionSlug: currentRegionSlug,
            displayName: canon?.displayName ?? currentRegionSlug.replace(/-/g, ' '),
        };
    }

    const discoveries = await listDiscoveredFactions(sessionId);
    const factions: FactionReputationView[] = [];

    for (const d of discoveries) {
        const score = await readEntityScore(
            sessionId,
            worldEntityId,
            factionReputationKey(d.factionSlug),
            d.factionSlug,
        );
        const catalog = getFactionCatalogEntry(d.factionSlug);
        const base = toRowView(factionReputationKey(d.factionSlug), score);
        factions.push({
            ...base,
            factionSlug: d.factionSlug,
            displayName: await resolveFactionDisplayName(d.factionSlug),
            archetype: catalog?.archetype ?? 'unknown',
            discoveredAt: d.discoveredAt.toISOString(),
        });
    }

    factions.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

    return { region, factions };
}
