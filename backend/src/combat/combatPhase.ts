/**
 * P0.4 — Máquina de estados de combate (transições pelo motor, não pela IA).
 */

export const COMBAT_PHASES = [
    'IDLE',
    'ENCOUNTER_ACTIVE',
    'ROUND_START',
    'TURN_START',
    'ACTION_DECLARED',
    'ROLL_PENDING',
    'RESOLVING',
    'AWAITING_NARRATION',
    'TURN_END',
    'ENCOUNTER_END',
] as const;

export type CombatPhase = (typeof COMBAT_PHASES)[number];

/** Transições permitidas (from → to[]). */
export const COMBAT_PHASE_TRANSITIONS: Record<CombatPhase, CombatPhase[]> = {
    IDLE: ['ENCOUNTER_ACTIVE'],
    ENCOUNTER_ACTIVE: ['ROUND_START', 'ENCOUNTER_END'],
    ROUND_START: ['TURN_START'],
    TURN_START: ['ACTION_DECLARED', 'ENCOUNTER_END'],
    ACTION_DECLARED: ['ROLL_PENDING', 'RESOLVING', 'TURN_END'],
    ROLL_PENDING: ['RESOLVING', 'ROLL_PENDING'],
    RESOLVING: ['AWAITING_NARRATION', 'ROLL_PENDING', 'TURN_END'],
    AWAITING_NARRATION: ['TURN_END'],
    TURN_END: ['TURN_START', 'ROUND_START', 'ENCOUNTER_END'],
    ENCOUNTER_END: ['IDLE'],
};

export function canTransitionCombatPhase(from: CombatPhase, to: CombatPhase): boolean {
    return COMBAT_PHASE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertCombatPhaseTransition(from: CombatPhase, to: CombatPhase): void {
    if (!canTransitionCombatPhase(from, to)) {
        console.warn(`[combatPhase] transição inválida ${from} → ${to}`);
    }
}
