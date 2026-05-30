import { publishWsToUser } from '../../GameMaster/transport/wsPubSub.js';
import { projectSessionWorldState } from '../../GameMaster/events/projector.js';
import { PenaiDataSource } from '../../GameMaster/database/data-source.js';
import { GameSession } from '../../GameMaster/database/entities/GameSession.js';
import { tickOfflineWorld } from '../../GameMaster/world/worldOfflinePenai.js';
import { advanceNpcRoutine } from '../../GameMaster/npc/npcFsmPenai.js';

export async function projectWorldPulse(sessionId: number): Promise<string[]> {
    const offlinePulses = await tickOfflineWorld(sessionId);
    const npcPulse = await advanceNpcRoutine(sessionId);
    const projected = await projectSessionWorldState(sessionId);
    const pulses = [
        ...offlinePulses,
        ...(npcPulse ? [npcPulse] : []),
        ...projected.activeRumors.map(r => `Rumor: ${r.title}`),
        ...projected.recentEvents.slice(0, 5).map(e => `Evento: ${e.type}`),
    ];

    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    const userId = session?.userId ?? 1;

    if (pulses.length) {
        await publishWsToUser(userId, {
            type: 'worldPulse',
            sessionId,
            locale: 'pt-BR',
            events: pulses,
            worldState: {
                currentRegionSlug: projected.currentRegionSlug,
                rumors: projected.activeRumors,
            },
        });
    }
    return pulses;
}
