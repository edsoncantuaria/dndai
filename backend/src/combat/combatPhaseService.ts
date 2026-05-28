import { AppDataSource } from '../database/data-source.js';
import { CombatEncounter } from '../entities/CombatEncounter.js';
import {
    assertCombatPhaseTransition,
    type CombatPhase,
    canTransitionCombatPhase,
} from './combatPhase.js';

/** Fases em que a IA pode narrar o desfecho de uma rolagem de combate. */
const COMBAT_NARRATION_PHASES: CombatPhase[] = ['RESOLVING', 'AWAITING_NARRATION'];

export function isCombatNarrationPhase(phase: CombatPhase): boolean {
    return COMBAT_NARRATION_PHASES.includes(phase);
}

/** Fase do encontro ativo, ou `null` se não houver combate ativo. */
export async function getActiveCombatPhase(sessionId: number): Promise<CombatPhase | null> {
    const repo = AppDataSource.getRepository(CombatEncounter);
    const encounter = await repo.findOne({
        where: { sessaoId: sessionId, isActive: true },
        order: { id: 'DESC' },
    });
    if (!encounter) return null;
    return (encounter.phase ?? 'IDLE') as CombatPhase;
}

/**
 * P0.4.3 — fora de combate ativo, narração segue fluxo normal;
 * com encontro ativo, só em fases pós-resolução mecânica.
 */
export async function shouldAllowCombatNarration(sessionId: number): Promise<boolean> {
    const phase = await getActiveCombatPhase(sessionId);
    if (phase === null) return true;
    return isCombatNarrationPhase(phase);
}

/** P0.4.3 — avança fase do encontro após resolução mecânica de rolagem. */
export async function advanceCombatPhaseAfterRoll(
    sessionId: number,
    opts: { hasFollowUpRoll: boolean; shouldNarrate: boolean },
): Promise<CombatPhase | null> {
    const repo = AppDataSource.getRepository(CombatEncounter);
    const encounter = await repo.findOne({
        where: { sessaoId: sessionId, isActive: true },
        order: { id: 'DESC' },
    });
    if (!encounter) return null;

    const current = (encounter.phase ?? 'IDLE') as CombatPhase;
    let next: CombatPhase = current;

    if (opts.hasFollowUpRoll) {
        next = 'ROLL_PENDING';
    } else if (opts.shouldNarrate && canTransitionCombatPhase(current, 'AWAITING_NARRATION')) {
        next = 'AWAITING_NARRATION';
    } else if (canTransitionCombatPhase(current, 'RESOLVING')) {
        next = 'RESOLVING';
    }

    if (next === current) return current;
    assertCombatPhaseTransition(current, next);
    encounter.phase = next;
    await repo.save(encounter);
    return next;
}
