// backend/src/services/semanticValidator.ts
import type { GameMasterFlowInput, GameMasterResponse } from '../schemas/gameSchemas.js';

export type SemanticIssue = {
    reason: string;
    hint: string;
    level?: 'error' | 'warn';
};

const skillKeywords = [
    'acrobacia', 'arcana', 'arcanismo', 'atletismo', 'furtividade', 'investigação',
    'percepção', 'persuasão', 'intimidação', 'sobrevivência', 'religião', 'história',
    'medicina', 'intuição', 'natureza', 'performance', 'manipulação'
];

const normalize = (value?: string | null) =>
    typeof value === 'string' ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';

const hasHostilesAlive = (response: GameMasterResponse): boolean => {
    const combatants = response.combatState?.combatants;
    if (!Array.isArray(combatants) || combatants.length === 0) return false;
    return combatants.some(combatant =>
        combatant && combatant.attitude === 'hostile' && !combatant.isDead && combatant.hp?.current !== 0
    );
};

const rollReasonHasSkill = (reason: string): boolean => {
    const normalized = normalize(reason);
    return skillKeywords.some(keyword => normalized.includes(keyword));
};

export const evaluateSemanticConsistency = (
    response: GameMasterResponse,
    input: GameMasterFlowInput
): SemanticIssue[] => {
    const issues: SemanticIssue[] = [];

    if (response.combatState?.isActive) {
        if (!hasHostilesAlive(response)) {
            issues.push({
                reason: 'active_combat_without_hostiles',
                hint: 'Seu combatState está ativo mas não há inimigos hostis vivos. Atualize as atitudes/HP ou encerre o combate corretamente.',
            });
        }
    }

    if (response.playerRollRequest && response.playerRollRequest.rollType === 'check') {
        const reason = response.playerRollRequest.reason ?? '';
        if (!rollReasonHasSkill(reason)) {
            issues.push({
                reason: 'roll_reason_missing_skill',
                hint: 'Quando rollType="check", descreva a perícia ou atributo no campo reason (ex.: "Teste de Arcana para purificar a relíquia").',
            });
        }
    }

    if (input.combatState?.isActive && !response.combatState?.initiativeOrder?.length) {
        issues.push({
            reason: 'missing_initiative_order',
            hint: 'Durante combate ativo, inclua initiativeOrder com os IDs dos combatentes na ordem correta.',
        });
    }

    return issues;
};

