import { PenaiDataSource } from '../database/data-source.js';
import { WorldEvent } from '../database/entities/WorldEvent.js';
import { GameSession } from '../database/entities/GameSession.js';
import { getPenaiCombatState } from '../combat/engine.js';

export async function buildMechanicalReplaySnapshot(sessionId: number): Promise<Record<string, unknown>> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    const events = await PenaiDataSource.getRepository(WorldEvent).find({
        where: { sessionId },
        order: { createdAt: 'ASC' },
    });

    let region = session?.currentRegionSlug ?? null;
    const combatState = await getPenaiCombatState(sessionId);
    const rollHistory: Array<Record<string, unknown>> = [];

    for (const ev of events) {
        if (ev.type === 'TRAVEL_COMPLETED') {
            const p = ev.payload as Record<string, unknown>;
            if (p.toRegionSlug) region = String(p.toRegionSlug);
        }
        if (ev.type === 'ROLL_RESOLVED') {
            rollHistory.push({ type: ev.type, payload: ev.payload, at: ev.createdAt });
        }
    }

    return {
        sessionId,
        currentRegionSlug: region,
        combatState,
        rollHistory: rollHistory.slice(-20),
        eventCount: events.length,
    };
}
