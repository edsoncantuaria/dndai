// backend/src/rules/rest.ts
import type { RulesCharacterSnapshot, RestIntentPayload, RuleCheckResult } from './types.js';
import type { CombatState } from '../types.js';

export interface RestEffectSummary {
    name: string;
    duration: string;
    benefits: string[];
    limitations: string[];
}

export const SHORT_REST_RULES: RestEffectSummary = {
    name: 'Descanso Curto',
    duration: 'Mínimo de 1 hora',
    benefits: [
        'Personagem pode gastar Dados de Vida para recuperar HP.',
        'Recurso que recarrega em descanso curto (ex.: Action Surge) é restaurado.',
    ],
    limitations: [
        'Uma criatura só pode fazer um descanso curto se não estiver em combate ativo.',
        'Algumas características exigem condições adicionais (ex.: música do Bardo).',
    ],
};

export const LONG_REST_RULES: RestEffectSummary = {
    name: 'Descanso Longo',
    duration: '8 horas (mínimo 6 dormindo)',
    benefits: [
        'HP e Dados de Vida são restaurados (no máximo metade dos Dados de Vida totais).',
        'Slots de magia e habilidades que recarregam no descanso longo são renovados.',
        'Reduz nível de Exaustão em 1.',
    ],
    limitations: [
        'Só pode ser feito uma vez a cada 24 horas.',
        'A interrupção prolongada (mais de 1 hora) faz o descanso falhar.',
    ],
};

export function getRestRules(type: 'short' | 'long'): RestEffectSummary {
    return type === 'short' ? SHORT_REST_RULES : LONG_REST_RULES;
}

export function calculateHitDiceRecovery(character: RulesCharacterSnapshot, type: 'short' | 'long') {
    if (type === 'short') return 0;
    return Math.max(1, Math.floor(character.level / 2));
}

export function validateRestIntent(
    _character: RulesCharacterSnapshot,
    payload: RestIntentPayload,
    combatState?: CombatState | null
): RuleCheckResult {
    if (combatState?.isActive) {
        return {
            status: 'rejected',
            reason: 'Não é possível descansar durante o combate ativo.',
        };
    }
    const rules = getRestRules(payload.restType);
    return {
        status: 'accepted',
        data: {
            restType: payload.restType,
            rules,
        },
        stateDelta: {
            rest: {
                type: payload.restType,
                benefits: rules.benefits,
                limitations: rules.limitations,
            },
        },
    };
}
