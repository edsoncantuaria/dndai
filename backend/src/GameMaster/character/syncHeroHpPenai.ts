import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { SessionCombatant } from '../database/entities/SessionCombatant.js';
import {
    getSessionHeroEntityId,
    loadHeroSessionStats,
    saveHeroSessionStats,
} from './heroStats.js';

/** Fonte canônica → espelho de combate (SessionCombatant side=hero). */
export async function syncHeroHpToCombatant(sessionId: number): Promise<void> {
    const heroEntityId = await getSessionHeroEntityId(sessionId);
    if (!heroEntityId) return;

    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    if (!session?.activeCombatEncounterId) return;

    const stats = await loadHeroSessionStats(sessionId, heroEntityId);
    const repo = PenaiDataSource.getRepository(SessionCombatant);
    const combatant = await repo.findOne({
        where: { encounterId: session.activeCombatEncounterId, entityKey: heroEntityId, side: 'hero' },
    });
    if (!combatant) return;

    combatant.hpCurrent = stats.hp;
    combatant.hpMax = stats.maxHp;
    combatant.armorClass = stats.ac;
    await repo.save(combatant);
}

/** Espelho de combate → fonte canônica (após delta no combatente herói). */
export async function syncHeroHpToCanonical(sessionId: number, hpCurrent: number): Promise<void> {
    const heroEntityId = await getSessionHeroEntityId(sessionId);
    if (!heroEntityId) return;
    const stats = await loadHeroSessionStats(sessionId, heroEntityId);
    stats.hp = Math.max(0, Math.min(stats.maxHp, hpCurrent));
    await saveHeroSessionStats(sessionId, heroEntityId, stats);
}

/** Chamado após qualquer mutação de HP — canonical vence; espelha no combatente. */
export async function syncHeroHpPenai(sessionId: number): Promise<void> {
    await syncHeroHpToCombatant(sessionId);
}
