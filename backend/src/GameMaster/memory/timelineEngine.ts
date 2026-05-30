import { PenaiDataSource } from '../database/data-source.js';
import { WorldEvent } from '../database/entities/WorldEvent.js';
import { humanizeWorldEvent } from '../events/eventHumanizer.js';
import { loadSessionGameClock } from '../world/gameClock.js';

export type TimelineDeltaEntry = {
    eventId: string;
    type: string;
    summary: string;
    worldDay: number;
    category: string;
};

/** Últimos eventos humanizados desde o dia anterior do relógio (delta para o narrador). */
export async function getTimelineDeltaForSession(
    sessionId: number,
    limit = 6,
): Promise<{ worldDay: number; worldHour: number; entries: TimelineDeltaEntry[] }> {
    const clock = await loadSessionGameClock(sessionId);
    const repo = PenaiDataSource.getRepository(WorldEvent);
    const rows = await repo.find({
        where: { sessionId },
        order: { createdAt: 'DESC' },
        take: 40,
    });

    const entries: TimelineDeltaEntry[] = [];
    for (const row of rows) {
        const human = humanizeWorldEvent({
            id: row.id,
            type: row.type,
            payload: row.payload,
            createdAt: row.createdAt,
        });
        if (!human) continue;
        const worldDay = Number((row.payload as { worldDay?: number }).worldDay ?? clock.day);
        entries.push({
            eventId: row.id,
            type: row.type,
            summary: human.summary,
            worldDay,
            category: human.category,
        });
        if (entries.length >= limit) break;
    }

    return { worldDay: clock.day, worldHour: clock.hour, entries };
}
