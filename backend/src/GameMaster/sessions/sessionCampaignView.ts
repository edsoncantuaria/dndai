import { PenaiDataSource } from '../database/data-source.js';
import { WorldEvent } from '../database/entities/WorldEvent.js';
import { WorldShard } from '../database/entities/WorldShard.js';
import { TimelineEntry } from '../database/entities/TimelineEntry.js';
import { loadSessionGameClock, type PenaiGameClock } from '../world/gameClock.js';
import { recallKnowledgeForSession } from '../world/knowledgeGraph.js';
import { loadSessionAggregate, type SessionAggregateView } from './sessionAggregate.js';
import { buildCampaignQuestViews, type CampaignQuestView } from './questCampaignHelpers.js';
import { resolveSessionShardId } from '../world/shardResolver.js';
import {
    getShardPoliticsState,
    politicsStateLabel,
    type ShardPoliticsState,
} from '../world/politicsState.js';

export type CampaignShardView = {
    id: string;
    regionSlug: string;
    displayName: string;
    version: number;
    politicsState: ShardPoliticsState;
    politicsLabel: string;
};

export type CampaignTimelineEntry = {
    eventId: string;
    eventType: string;
    category: string;
    summary: string;
    worldDay: number;
    at: string;
};

export type SessionCampaignView = SessionAggregateView & {
    gameClock: PenaiGameClock;
    knowledgeSnippets: string[];
    activeQuests: CampaignQuestView[];
    lastPulseAt: string | null;
    shard: CampaignShardView | null;
    timelineRecent: CampaignTimelineEntry[];
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
        where: { sessionId, type: 'WORLD_PULSE_RENDERED' },
        order: { createdAt: 'DESC' },
    });

    const regionFear =
        typeof aggregate.regionState?.fear === 'number' ? aggregate.regionState.fear : 0;

    const activeQuests = await buildCampaignQuestViews(sessionId);

    let shard: CampaignShardView | null = null;
    const shardId = await resolveSessionShardId(sessionId);
    if (shardId) {
        const row = await PenaiDataSource.getRepository(WorldShard).findOne({
            where: { id: shardId },
        });
        if (row) {
            const politics = await getShardPoliticsState(shardId);
            shard = {
                id: row.id,
                regionSlug: row.regionSlug,
                displayName: row.displayName,
                version: row.version,
                politicsState: politics,
                politicsLabel: politicsStateLabel(politics),
            };
        }
    }

    const timelineRows = await PenaiDataSource.getRepository(TimelineEntry).find({
        where: { sessionId },
        order: { createdAt: 'DESC' },
        take: 5,
    });
    const timelineRecent: CampaignTimelineEntry[] = timelineRows.map(t => ({
        eventId: t.eventId,
        eventType: t.eventType,
        category: t.category,
        summary: t.summary,
        worldDay: t.worldDay,
        at: t.createdAt.toISOString(),
    }));

    return {
        ...aggregate,
        activeQuests,
        gameClock,
        knowledgeSnippets,
        lastPulseAt: pulseEvent?.createdAt?.toISOString() ?? null,
        shard,
        timelineRecent,
        campaignDigest: {
            questCount: activeQuests.length,
            regionFear,
        },
    };
}
