import type { RuleCheckResult } from './types.js';
import type { CombatState } from '../schemas/gameSchemas.js';

export type StartEncounterCombatant = {
    id: string;
    name: string;
    hp: number;
    maxHp: number;
    ac?: number;
    isPlayer?: boolean;
    attitude?: 'hostile' | 'ally' | 'neutral';
    initiative?: number;
};

export type StartEncounterPayload = {
    combatants: StartEncounterCombatant[];
    round?: number;
    turn?: number;
};

export function validateStartEncounterIntent(
    combatState: CombatState | null | undefined,
    payload: StartEncounterPayload,
): RuleCheckResult {
    if (combatState?.isActive) {
        return { status: 'rejected', reason: 'Já existe um combate ativo.' };
    }
    if (!Array.isArray(payload.combatants) || payload.combatants.length < 2) {
        return { status: 'rejected', reason: 'Informe pelo menos dois combatentes (jogador + inimigos).' };
    }
    const hasPlayer = payload.combatants.some(c => c.isPlayer);
    if (!hasPlayer) {
        return { status: 'rejected', reason: 'O encontro precisa incluir o combatente do jogador (isPlayer: true).' };
    }
    for (const c of payload.combatants) {
        if (!c.id?.trim() || !c.name?.trim()) {
            return { status: 'rejected', reason: 'Cada combatente precisa de id e name.' };
        }
        if (!Number.isFinite(c.hp) || !Number.isFinite(c.maxHp) || c.maxHp < 1) {
            return { status: 'rejected', reason: `PV inválidos para ${c.name}.` };
        }
    }
    return {
        status: 'accepted',
        authoritativeSignature: 'start-encounter',
        data: payload as unknown as Record<string, unknown>,
    };
}
