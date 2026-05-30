import { PenaiDataSource } from '../database/data-source.js';
import { WorldEvent } from '../database/entities/WorldEvent.js';
import { loadSessionGameClock, type PenaiGameClock } from '../world/gameClock.js';
import { recallKnowledgeForSession } from '../world/knowledgeGraph.js';
import { loadSessionAggregate, type SessionAggregateView } from './sessionAggregate.js';
import { SessionQuest } from '../database/entities/SessionQuest.js';

export type SessionCampaignView = SessionAggregateView & {
    gameClock: PenaiGameClock;
    knowledgeSnippets: string[];
    activeQuests: Array<{
        questSlug: string;
        title: string;
        stage: number;
        status: string;
    }>;
    lastPulseAt: string | null;
    campaignDigest: {
        questCount: number;
        regionFear: number;
    };
};

export async function loadSessionCampaignView(sessionId: number): Promise<SessionCampaignView> {
    const aggregate = await loadSessionAggregate(sessionId);
    const gameClock = await loadSessionGameClock(sessionId);
    const knowledgeSnippets = await recallKnowledgeForSession(sessionId, 6);

    const eventRepo = PenaiDataSource.getRepository(WorldEvent);
    const pulseEvent = await eventRepo.findOne({
        where: { sessionId },
        order: { createdAt: 'DESC' },
    });

    const regionFear =
        typeof aggregate.regionState?.fear === 'number' ? aggregate.regionState.fear : 0;

    const quests = await PenaiDataSource.getRepository(SessionQuest).find({
        where: { sessionId, status: 'active' },
        order: { startedAt: 'ASC' },
        take: 10,
    });

    return {
        ...aggregate,
        activeQuests: quests.map(q => ({
            questSlug: q.questSlug,
            title: q.title,
            stage: q.stage,
            status: q.status,
        })),
        gameClock,
        knowledgeSnippets,
        lastPulseAt: pulseEvent?.createdAt?.toISOString() ?? null,
        campaignDigest: {
            questCount: quests.length,
            regionFear,
        },
    };
}
