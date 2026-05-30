import { PenaiDataSource } from '../database/data-source.js';
import { SessionSnapshot } from '../database/entities/SessionSnapshot.js';
import { GameSession } from '../database/entities/GameSession.js';
import { getOrCreateRegionState } from '../world/campaignState.js';
import { loadHeroReputationView, type HeroReputationView } from '../world/reputationView.js';
import { listActiveQuests } from '../world/sessionQuests.js';
import { SessionKnowledge } from '../database/entities/SessionKnowledge.js';

export type SessionAggregateView = {
    sessionId: number;
    regionSlug: string | null;
    regionState: Record<string, unknown> | null;
    activeQuests: Array<{ questSlug: string; title: string; stage: number }>;
    heroReputation: Array<{ targetSlug: string; score: number }>;
    reputation: HeroReputationView;
    knowledgeCount: number;
};

export async function loadSessionAggregate(sessionId: number): Promise<SessionAggregateView> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    const regionSlug = session?.currentRegionSlug ?? null;
    let regionState: Record<string, unknown> | null = null;
    if (regionSlug) {
        const rs = await getOrCreateRegionState(sessionId, regionSlug);
        regionState = {
            fear: rs.fear,
            prosperity: rs.prosperity,
            crime: rs.crime,
            resources: rs.resources,
        };
    }

    const quests = await listActiveQuests(sessionId);
    const heroId = session?.heroWorldEntityId ?? null;
    const reputation = heroId
        ? await loadHeroReputationView(sessionId, heroId, regionSlug)
        : { region: null, factions: [] };

    const heroReputation = [
        ...(reputation.region
            ? [{ targetSlug: reputation.region.regionSlug, score: reputation.region.score }]
            : []),
        ...reputation.factions.map(f => ({ targetSlug: f.factionSlug, score: f.score })),
    ];

    const knowledgeCount = await PenaiDataSource.getRepository(SessionKnowledge).count({
        where: { sessionId },
    });

    return {
        sessionId,
        regionSlug,
        regionState,
        activeQuests: quests.map(q => ({
            questSlug: q.questSlug,
            title: q.title,
            stage: q.stage,
        })),
        heroReputation,
        reputation,
        knowledgeCount,
    };
}

export async function saveSessionAggregateSnapshot(
    sessionId: number,
    actionSequence: number,
): Promise<void> {
    const aggregate = await loadSessionAggregate(sessionId);
    const repo = PenaiDataSource.getRepository(SessionSnapshot);
    await repo.save(
        repo.create({
            sessionId,
            actionSequence,
            payload: aggregate as unknown as Record<string, unknown>,
        }),
    );
}
