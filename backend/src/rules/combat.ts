// backend/src/rules/combat.ts
import { CONDITION_MAP, type ConditionEffect } from './conditions.js';

export interface AttackModifierReport {
    advantage: boolean;
    disadvantage: boolean;
    reasons: string[];
}

const normalizeConditions = (conditions?: string[]) =>
    (conditions ?? []).map(value => value.toLowerCase());

const hasEffect = (effect: ConditionEffect | undefined, key: keyof ConditionEffect) => {
    if (!effect) return false;
    return Boolean(effect[key]);
};

export function deriveAttackModifiers(
    attackerConditions?: string[],
    targetConditions?: string[]
): AttackModifierReport {
    const report: AttackModifierReport = {
        advantage: false,
        disadvantage: false,
        reasons: [],
    };

    for (const condition of normalizeConditions(attackerConditions)) {
        const effects = CONDITION_MAP[condition];
        if (hasEffect(effects, 'attackRollDisadvantage')) {
            report.disadvantage = true;
            report.reasons.push(`Desvantagem: ${condition}`);
        }
    }

    for (const condition of normalizeConditions(targetConditions)) {
        const effects = CONDITION_MAP[condition];
        if (hasEffect(effects, 'attackRollAdvantageAgainst')) {
            report.advantage = true;
            report.reasons.push(`Vantagem: alvo ${condition}`);
        }
    }

    return report;
}

export const MIN_CONCENTRATION_DC = 10;

export function concentrationDcFromDamage(damageTaken: number): number {
    if (!Number.isFinite(damageTaken)) return MIN_CONCENTRATION_DC;
    return Math.max(MIN_CONCENTRATION_DC, Math.floor(damageTaken / 2));
}

export function shouldForceConcentrationCheck(isConcentrating: boolean, damageTaken: number): boolean {
    return isConcentrating && damageTaken > 0 && Number.isFinite(damageTaken);
}
