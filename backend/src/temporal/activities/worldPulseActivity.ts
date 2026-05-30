import { publishWsToUser } from '../../GameMaster/transport/wsPubSub.js';
import { PenaiDataSource } from '../../GameMaster/database/data-source.js';
import { GameSession } from '../../GameMaster/database/entities/GameSession.js';
import { tickWorldSimulation } from '../../GameMaster/world/simulation/engine.js';

export async function projectWorldPulse(sessionId: number): Promise<string[]> {
    const { listActiveQuests, startSessionQuest } = await import(
        '../../GameMaster/world/sessionQuests.js'
    );
    const activeQuests = await listActiveQuests(sessionId);
    if (!activeQuests.length) {
        await startSessionQuest({
            sessionId,
            questSlug: 'culto-escarlene-cresce',
            title: 'O Culto Escarlene cresce',
        });
    }

    const { loadSessionCampaignView } = await import(
        '../../GameMaster/sessions/sessionCampaignView.js'
    );
    const { pulses, projected } = await tickWorldSimulation(sessionId);

    let campaignDigest = { questCount: activeQuests.length, regionFear: 0 };
    try {
        const campaign = await loadSessionCampaignView(sessionId);
        campaignDigest = campaign.campaignDigest;
    } catch {
        /* sessão parcial */
    }

    const enriched = [
        ...pulses,
        ...projected.activeRumors.map(r => `Rumor: ${r.title}`),
        ...projected.recentEvents.slice(0, 5).map(e => `Evento: ${e.type}`),
    ];

    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    const userId = session?.userId ?? 1;

    if (enriched.length) {
        await publishWsToUser(userId, {
            type: 'worldPulse',
            sessionId,
            locale: 'pt-BR',
            events: enriched,
            worldState: {
                currentRegionSlug: projected.currentRegionSlug,
                rumors: projected.activeRumors,
            },
            campaignDigest,
        });
    }
    return enriched;
}
