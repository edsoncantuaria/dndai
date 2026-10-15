import { PenaiDataSource } from '../database/data-source.js';
import { TimelineEntry } from '../database/entities/TimelineEntry.js';
import { humanizeWorldEvent } from '../events/eventHumanizer.js';
import { resolveSessionShardId } from '../world/shardResolver.js';
import { loadSessionGameClock } from '../world/gameClock.js';

/** Indexa evento na timeline materializada (P11). */
export async function recordTimelineEntry(opts: {
    sessionId: number;
    eventId: string;
    eventType: string;
    payload: Record<string, unknown>;
    createdAt: Date;
}): Promise<void> {
    const human = humanizeWorldEvent({
        id: opts.eventId,
        type: opts.eventType,
        payload: opts.payload,
        createdAt: opts.createdAt,
    });
    if (!human) return;

    const clock = await loadSessionGameClock(opts.sessionId);
    const worldDay = Number(opts.payload.worldDay ?? clock.day);
    const worldHour = Number(opts.payload.worldHour ?? clock.hour);
    const shardId = await resolveSessionShardId(opts.sessionId);

    const repo = PenaiDataSource.getRepository(TimelineEntry);
    const exists = await repo.findOne({ where: { eventId: opts.eventId } });
    if (exists) return;

    await repo.save(
        repo.create({
            shardId,
            sessionId: opts.sessionId,
            eventId: opts.eventId,
            eventType: opts.eventType,
            worldDay,
            worldHour,
            category: human.category,
            summary: human.summary.slice(0, 320),
        }),
    );
}

const INDEXED_TYPES = new Set([
    'FACT_RECORDED',
    'TIME_ADVANCED',
    'QUEST_STAGE_ADVANCED',
    'QUEST_STARTED',
    'TRAVEL_COMPLETED',
    'WORLD_PULSE_RENDERED',
    'CREATURE_SLAIN',
    'RUMOR_SPREAD',
    'POLITICS_STATE_CHANGED',
    'SUPPLY_SHORTAGE',
]);

export function shouldIndexTimelineEvent(type: string): boolean {
    return INDEXED_TYPES.has(type);
}
