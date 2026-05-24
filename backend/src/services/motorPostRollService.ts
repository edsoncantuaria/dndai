import type { PlayerRollRequest } from '../types.js';
import { awardMotorXpToCharacter } from './motorXpService.js';
import { calculateSkillCheckXp } from './xpService.js';
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { syncEntityHpToSessionCombat } from './combatHpBridge.js';
import type { RollResolutionResult } from './ruleResolutionService.js';

/** XP de perícia quando o jogador passa no teste (motor). */
export async function awardSkillCheckXpIfSuccess(params: {
    sessionId: number;
    pending: PlayerRollRequest;
    total: number;
}): Promise<{ xpAwarded: number } | null> {
    const { sessionId, pending, total } = params;
    if (pending.rollType !== 'check' && pending.rollType !== 'save') return null;
    if (typeof pending.dc !== 'number' || total < pending.dc) return null;

    const sessaoRepo = AppDataSource.getRepository(SessaoIA);
    const sessao = await sessaoRepo.findOne({
        where: { id: sessionId },
        select: ['id', 'characterId'],
    });
    if (!sessao?.characterId) return null;

    const xp = calculateSkillCheckXp(pending.dc, undefined);
    if (xp <= 0) return null;

    const result = await awardMotorXpToCharacter(sessao.characterId, [
        {
            type: 'skill',
            dc: pending.dc,
            description: pending.reason || pending.rollType,
        },
    ]);
    return result ? { xpAwarded: result.applied.totalXpAwarded } : null;
}

/** Após rolagem estruturada: ponte entity→combate + XP de perícia. */
export async function applyMotorPostRollEffects(params: {
    sessionId: number;
    pending: PlayerRollRequest;
    total: number;
    resolutionResult: RollResolutionResult | null;
    combatState?: import('../schemas/gameSchemas.js').CombatState | null;
}): Promise<{
    motorCombat: Awaited<ReturnType<typeof syncEntityHpToSessionCombat>> | null;
    skillXp: { xpAwarded: number } | null;
}> {
    const { sessionId, pending, total, resolutionResult } = params;
    let motorCombat = null;

    const sessaoRepo = AppDataSource.getRepository(SessaoIA);
    const sessao = await sessaoRepo.findOne({
        where: { id: sessionId },
        select: ['id', 'characterId'],
    });

    if (resolutionResult?.updatedEntity) {
        const { entityId, hp, encounterId } = resolutionResult.updatedEntity;
        motorCombat = await syncEntityHpToSessionCombat({
            sessaoId: sessionId,
            entityId,
            hpCurrent: hp,
            characterId: sessao?.characterId ?? undefined,
        });
    }

    const skillXp = await awardSkillCheckXpIfSuccess({ sessionId, pending, total });

    return { motorCombat, skillXp };
}
