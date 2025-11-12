import type { RuleCheckResult } from './types.js';

const DICE_REGEX = /([+-]?\d+d\d+)/gi;

export function computeDamageRolls(formula: string): string[] {
    const matches = formula.match(DICE_REGEX);
    return matches ?? [];
}

export function buildDamageRollResult(spellName: string, dice: string[]): RuleCheckResult {
    return {
        status: 'needs_roll',
        rollRequest: {
            formula: dice[0] ?? '1d6',
            modifierBreakdown: [`Dano de ${spellName}`],
            context: `Dano de ${spellName}`,
        },
        data: { dice },
    };
}
