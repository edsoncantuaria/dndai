import type {
    RuleCheckResult,
    DamageIntentPayload,
    HealingIntentPayload,
} from './types.js';
import type { CombatState } from '../types.js';

const DICE_REGEX = /([+-]?\d+d\d+)|([+-]?\d+)/gi;

const sanitizeFormula = (formula: string, modifier = 0) => {
    const trimmed = formula.trim();
    if (!trimmed) return '1d4';
    const hasModifier = /[+-]\s*\d+$/.test(trimmed);
    if (modifier === 0 || hasModifier) {
        return trimmed;
    }
    const sign = modifier >= 0 ? '+' : '-';
    return `${trimmed}${sign}${Math.abs(modifier)}`;
};

export function computeDamageRolls(formula: string): string[] {
    const matches = formula.match(DICE_REGEX);
    return matches ?? [];
}

export function buildDamageRollResult(
    spellName: string,
    dice: string[],
    metadata?: Record<string, any>
): RuleCheckResult {
    return {
        status: 'needs_roll',
        rollRequest: {
            formula: dice[0] ?? '1d6',
            modifierBreakdown: [`Dano de ${spellName}`],
            context: `Dano de ${spellName}`,
            metadata: {
                source: {
                    kind: 'spell',
                    name: spellName,
                },
                damageFormula: dice.join(' + '),
                ...metadata,
            },
        },
        data: { dice },
    };
}

const buildTargetDescriptor = (payloadTarget: DamageIntentPayload['target']) => {
    if (!payloadTarget) return undefined;
    return [
        {
            kind: payloadTarget.kind,
            id: payloadTarget.entityId,
            name: payloadTarget.name,
            encounterId: payloadTarget.encounterId,
            characterId: payloadTarget.characterId,
        },
    ];
};

export function validateDamageIntent(
    payload: DamageIntentPayload,
    _combatState?: CombatState | null
): RuleCheckResult {
    const formula = sanitizeFormula(payload.damageFormula, payload.modifier);
    return {
        status: 'needs_roll',
        rollRequest: {
            formula,
            modifierBreakdown: [`Fonte: ${payload.source.name}`],
            context: `Rolagem de dano (${payload.source.name})`,
            metadata: {
                source: {
                    kind: payload.source.kind,
                    index: payload.source.index,
                    name: payload.source.name,
                    damageType: payload.source.damageType,
                },
                targets: buildTargetDescriptor(payload.target),
                damageFormula: formula,
                damageType: payload.source.damageType,
                effect: 'damage',
            },
        },
        data: {
            damageType: payload.source.damageType,
            target: payload.target,
        },
    };
}

export function validateHealingIntent(payload: HealingIntentPayload): RuleCheckResult {
    const formula = sanitizeFormula(payload.healFormula, payload.modifier);
    return {
        status: 'needs_roll',
        rollRequest: {
            formula,
            modifierBreakdown: [`Fonte: ${payload.source.name}`],
            context: `Rolagem de cura (${payload.source.name})`,
            metadata: {
                source: {
                    kind: payload.source.kind,
                    index: payload.source.index,
                    name: payload.source.name,
                },
                targets: buildTargetDescriptor(payload.target),
                damageFormula: formula,
                effect: 'healing',
            },
        },
        data: {
            target: payload.target,
        },
    };
}

export function validateConsumeItemIntent(payload: { quantity: number; itemId?: number; itemIndex?: string }): RuleCheckResult {
    if (!payload.itemId && !payload.itemIndex) {
        return {
            status: 'rejected',
            reason: 'Informe itemId ou itemIndex para consumir um item.',
        };
    }
    if (payload.quantity <= 0) {
        return {
            status: 'rejected',
            reason: 'Quantidade deve ser positiva.',
        };
    }
    return {
        status: 'accepted',
        stateDelta: {
            character: {
                inventory: [
                    {
                        itemId: payload.itemId,
                        itemIndex: payload.itemIndex,
                        quantityDelta: -Math.abs(payload.quantity),
                    },
                ],
            },
        },
        data: {
            action: 'consume-item',
            itemId: payload.itemId,
            itemIndex: payload.itemIndex,
            quantity: payload.quantity,
        },
    };
}
