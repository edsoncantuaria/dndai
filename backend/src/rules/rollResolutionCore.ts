import type { PlayerRollRequest } from '../types.js';
import type { RollTargetDescriptor } from './types.js';

const SIMPLE_DAMAGE_REGEX = /^\s*([+-]?\d+d\d+)([+-]\d+)?\s*$/i;

export const describeRollTarget = (target?: RollTargetDescriptor) => {
    if (!target) return 'o alvo';
    if (target.kind === 'character') return 'você';
    return target.name ?? 'o alvo';
};

export const sanitizeFormulaNotation = (formula?: string, modifier = 0) => {
    if (!formula) return { dice: '1d6', modifier: Math.max(0, modifier) };
    const compact = formula.replace(/\s+/g, '');
    const match = SIMPLE_DAMAGE_REGEX.exec(compact);
    if (!match) {
        return { dice: '1d6', modifier: Math.max(0, modifier) };
    }
    const dice = match[1];
    const mod = match[2] ? Number(match[2]) : 0;
    return { dice, modifier: mod + modifier };
};

const cloneWithoutResourceCosts = (metadata?: PlayerRollRequest['metadata']) => {
    if (!metadata) return undefined;
    const { resourceCosts, ...rest } = metadata;
    return rest;
};

export type DamageFollowUpContext = {
    actionId?: string;
    intentType?: string;
};

export type DamageFollowUpResult = {
    request: Omit<PlayerRollRequest, 'requestId'>;
    context?: DamageFollowUpContext & { metadata?: Record<string, unknown> };
};

export function buildDamageFollowUp(
    pending: { context?: DamageFollowUpContext; requestId?: string },
    metadata: PlayerRollRequest['metadata'],
): DamageFollowUpResult | undefined {
    if (!metadata?.damageFormula) return undefined;
    const { dice, modifier } = sanitizeFormulaNotation(metadata.damageFormula);
    const reason = `Motor de Regras - Dano (${metadata.source?.name || 'Ataque'})`;
    const sanitizedMetadata = {
        ...cloneWithoutResourceCosts(metadata),
        effect: 'damage' as const,
    };
    return {
        request: {
            reason,
            dice,
            modifier,
            rollType: 'damage',
            metadata: sanitizedMetadata,
        },
        context: {
            actionId: pending.context?.actionId ?? pending.requestId,
            intentType: 'damage',
            metadata: sanitizedMetadata as Record<string, unknown>,
        },
    };
}

/** P0.4.3/4 — contrato de narração por efeito (testável sem DB). */
export function rollResolutionShouldNarrate(
    effect: 'attack' | 'damage' | 'healing',
    opts: { hasDamageFollowUp?: boolean },
): boolean {
    if (effect === 'attack') {
        return opts.hasDamageFollowUp ? false : true;
    }
    return true;
}

export type AttackResolutionCore = {
    hit: boolean;
    armorClass?: number;
    total: number;
    targetName?: string;
    shouldNarrate: boolean;
    nextRollRequest?: DamageFollowUpResult;
    hints: string[];
};

export function resolveAttackRollCore(
    pending: { context?: DamageFollowUpContext; requestId?: string },
    metadata: PlayerRollRequest['metadata'],
    total: number,
): AttackResolutionCore {
    const target = metadata?.targets?.[0];
    const armorClass = target?.armorClass;
    const hit = typeof armorClass === 'number' ? total >= armorClass : true;
    const nextRollRequest = hit ? buildDamageFollowUp(pending, metadata) : undefined;
    const hints = [
        hit
            ? `Ataque acertou ${describeRollTarget(target)}${typeof armorClass === 'number' ? ` (CA ${armorClass})` : ''}.`
            : `Ataque falhou contra ${describeRollTarget(target)}${typeof armorClass === 'number' ? ` (CA ${armorClass})` : ''}.`,
    ];
    return {
        hit,
        armorClass,
        total,
        targetName: target?.name,
        shouldNarrate: rollResolutionShouldNarrate('attack', {
            hasDamageFollowUp: Boolean(nextRollRequest),
        }),
        nextRollRequest,
        hints,
    };
}

export function resolveEffectAmount(total: number): number {
    return total;
}
