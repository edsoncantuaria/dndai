import { appendWorldEvent } from '../events/store.js';
import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { SessionCombatant } from '../database/entities/SessionCombatant.js';
import { adjustEntityReputation } from '../world/campaignState.js';
import { recordWitnessedFact, listPresentEntityIds } from '../world/knowledgeGraph.js';
import { projectSessionWorldState } from '../events/projector.js';

/** Emite CREATURE_SLAIN e efeitos de campanha após vitória em combate. */
export async function emitCampaignCombatVictory(sessionId: number, encounterId: number): Promise<void> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    const regionSlug = session?.currentRegionSlug ?? 'unknown';
    const repo = PenaiDataSource.getRepository(SessionCombatant);
    const enemies = await repo.find({ where: { encounterId, side: 'enemy' } });
    const qty = enemies.length || 1;
    const creatureSlug = enemies[0]?.entityKey ?? 'hostile';

    await appendWorldEvent({
        type: 'CREATURE_SLAIN',
        sessionId,
        payload: { creatureSlug, regionSlug, qty },
    });

    await projectSessionWorldState(sessionId);

    const heroId = session?.heroWorldEntityId;
    if (heroId) {
        await adjustEntityReputation(sessionId, heroId, regionSlug, 5);
    }

    const witnesses = await listPresentEntityIds(sessionId);
    if (witnesses.length) {
        await recordWitnessedFact({
            sessionId,
            factKey: `combat_victory_${encounterId}`,
            factText: `Vitória sobre ${qty} inimigo(s) na região ${regionSlug}.`,
            witnessEntityIds: witnesses,
        });
    }
}
