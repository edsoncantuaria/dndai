// backend/src/rules/utils.ts
import type { Ability, RulesCharacterSnapshot } from './types.js';

export function abilityModifier(score: number): number {
    if (typeof score !== 'number' || Number.isNaN(score)) return 0;
    return Math.floor((score - 10) / 2);
}

export function computeProficiencyBonus(level: number): number {
    if (!Number.isFinite(level)) return 2;
    return 2 + Math.floor((Math.max(level, 1) - 1) / 4);
}

export function getAbilityScore(character: RulesCharacterSnapshot, ability: Ability): number {
    return character.abilities?.[ability] ?? 10;
}

export function getAttackAbility(character: RulesCharacterSnapshot, ability?: Ability): Ability {
    if (ability) return ability;
    const str = getAbilityScore(character, 'strength');
    const dex = getAbilityScore(character, 'dexterity');
    return str >= dex ? 'strength' : 'dexterity';
}

export function computeAbilityBonus(params: {
    character: RulesCharacterSnapshot;
    ability: Ability;
    proficiency?: boolean;
    extraBonus?: number;
}): { total: number; breakdown: string[] } {
    const abilityScore = getAbilityScore(params.character, params.ability);
    const abilityMod = abilityModifier(abilityScore);
    const breakdown = [`${params.ability.toUpperCase()} mod (${abilityMod})`];
    let total = abilityMod;

    if (params.proficiency) {
        total += params.character.proficiencyBonus;
        breakdown.push(`Proficiência (+${params.character.proficiencyBonus})`);
    }

    if (params.extraBonus) {
        total += params.extraBonus;
        breakdown.push(`Bônus Extra (${params.extraBonus})`);
    } else if (params.character.extraAttackBonus) {
        total += params.character.extraAttackBonus;
        breakdown.push(`Bônus do personagem (${params.character.extraAttackBonus})`);
    }

    return { total, breakdown };
}
