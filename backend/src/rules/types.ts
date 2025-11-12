// backend/src/rules/types.ts
export type Ability =
    | 'strength'
    | 'dexterity'
    | 'constitution'
    | 'intelligence'
    | 'wisdom'
    | 'charisma';

export type RuleCheckStatus = 'accepted' | 'rejected' | 'needs_roll';

export interface RollRequest {
    formula: string;
    modifierBreakdown: string[];
    context: string;
    targetDc?: number;
}

export interface RuleCheckResult {
    status: RuleCheckStatus;
    reason?: string;
    rollRequest?: RollRequest;
    data?: Record<string, unknown>;
    stateDelta?: Record<string, unknown>;
}

export interface RulesCharacterSnapshot {
    id: string;
    name: string;
    level: number;
    proficiencyBonus: number;
    abilities: Record<Ability, number>;
    weaponProficiencies?: string[];
    skillProficiencies?: string[];
    extraAttackBonus?: number;
    inventory?: { index?: string; name?: string; equipped?: boolean }[];
}

export interface WeaponAttackIntent {
    weaponIndex: string;
    ability?: Ability;
    proficiency?: boolean;
    targetArmorClass?: number;
    context?: string;
}

export interface SkillCheckIntentPayload {
    skillIndex: string;
    ability?: Ability;
    dc?: number;
    proficiency?: boolean;
}

export interface SpellAttackIntentPayload {
    spellIndex: string;
    ability: Ability;
    proficiency?: boolean;
    targetArmorClass?: number;
    damageOverride?: string;
}

export interface RestIntentPayload {
    restType: 'short' | 'long';
}

export interface NormalizedSkill {
    index: string;
    name: string;
    ability: string;
    description: string[];
}
