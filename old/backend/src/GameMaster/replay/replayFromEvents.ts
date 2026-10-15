import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { WorldEvent } from '../database/entities/WorldEvent.js';
import { applyEventProjection } from '../events/projector.js';
import { EVENT_PROJECTORS } from '../events/projector.js';

export type ReplayResult = {
    sessionId: number;
    eventsReplayed: number;
    typesApplied: string[];
};

/**
 * Reaplica projectors a partir do log (P10). Não reconstrói combate/inventário.
 */
export async function replaySessionProjectors(sessionId: number): Promise<ReplayResult> {
    const sessionRepo = PenaiDataSource.getRepository(GameSession);
    const session = await sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new Error('Sessão não encontrada');

    session.lastProjectedEventId = null;
    await sessionRepo.save(session);

    const eventRepo = PenaiDataSource.getRepository(WorldEvent);
    const events = await eventRepo.find({
        where: { sessionId },
        order: { id: 'ASC' },
    });

    const typesApplied = new Set<string>();
    for (const ev of events) {
        if (!EVENT_PROJECTORS[ev.type]) continue;
        await applyEventProjection(ev);
        typesApplied.add(ev.type);
    }

    if (events.length) {
        session.lastProjectedEventId = events[events.length - 1].id;
        await sessionRepo.save(session);
    }

    return {
        sessionId,
        eventsReplayed: events.length,
        typesApplied: [...typesApplied],
    };
}
