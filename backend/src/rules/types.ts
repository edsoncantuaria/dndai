// backend/src/rules/types.ts
export type Ability =
    | 'strength'
    | 'dexterity'
    | 'constitution'
    | 'intelligence'
    | 'wisdom'
    | 'charisma';

export type RuleCheckStatus = 'accepted' | 'rejected' | 'needs_roll';

export type RollSourceKind = 'weapon' | 'spell' | 'skill' | 'feature' | 'item';

export interface RollSourceDescriptor {
    kind: RollSourceKind;
    index?: string;
    name?: string;
    damageDice?: string;
    damageType?: string;
}

export type RollTargetKind = 'character' | 'entity' | 'object';

export interface RollTargetDescriptor {
    kind: RollTargetKind;
    id?: string;
    name?: string;
    armorClass?: number;
    encounterId?: number;
    characterId?: number;
}

export type RollResourceKind = 'spell-slot' | 'class-resource' | 'item';

export interface RollResourceCost {
    kind: RollResourceKind;
    level?: number;
    resourceKey?: string;
    amount?: number;
    itemId?: number;
    itemIndex?: string;
}

export type RollEffect = 'damage' | 'healing' | 'attack';

export interface RollRequestMetadata {
    source?: RollSourceDescriptor;
    targets?: RollTargetDescriptor[];
    damageFormula?: string;
    damageType?: string;
    resourceCosts?: RollResourceCost[];
    effect?: RollEffect;
}

export interface RollRequest {
    formula: string;
    modifierBreakdown: string[];
    context: string;
    targetDc?: number;
    advantage?: boolean;
    disadvantage?: boolean;
    metadata?: RollRequestMetadata;
}

export interface EntityStateDelta {
    encounterId: number;
    entityId: string;
    delta: {
        hp?: {
            setTo?: number;
            delta?: number;
        };
        metadata?: Record<string, any>;
        activeConditions?: string[];
        pendingEffects?: any[];
    };
};

export interface RuleCheckResult {
    status: RuleCheckStatus;
    reason?: string;
    rollRequest?: RollRequest;
    data?: Record<string, unknown>;
    authoritativeSignature?: string;
    stateDelta?: {
        pendingAttack?: {
            weapon?: string;
            spell?: string;
            damageFormula?: string;
            damageType?: string;
        };
        rest?: { type: 'short' | 'long'; benefits?: string[] };
        character?: CharacterStateDelta;
        entities?: EntityStateDelta[];
        [key: string]: any;
    };
}

export interface CharacterStateDelta {
    hp?: {
        setToMax?: boolean;
        delta?: number;
    };
    resources?: {
        type: string;
        key: string;
        delta: number;
    }[];
    inventory?: {
        itemIndex?: string;
        itemId?: number;
        quantityDelta: number;
    }[];
}

export interface CharacterResourceSnapshot {
    type: string;
    key: string;
    current: number;
    max: number;
    refresh?: 'short-rest' | 'long-rest';
    metadata?: Record<string, any>;
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
    conditions?: string[];
    resources?: CharacterResourceSnapshot[];
    spellcasting?: {
        ability?: Ability;
        saveDc?: number;
        attackBonus?: number;
    };
}

export interface WeaponAttackIntent {
    weaponIndex: string;
    ability?: Ability;
    proficiency?: boolean;
    targetArmorClass?: number;
    targetName?: string;
    targetId?: string;
    targetKind?: 'character' | 'entity';
    targetConditions?: string[];
    context?: string;
}

export type SkillDifficulty = 'very_easy' | 'easy' | 'medium' | 'hard' | 'very_hard' | 'nearly_impossible';

export interface SkillCheckIntentPayload {
    skillIndex: string;
    ability?: Ability;
    dc?: number;
    difficulty?: SkillDifficulty;
    proficiency?: boolean;
}

export interface SpellAttackIntentPayload {
    spellIndex: string;
    ability: Ability;
    proficiency?: boolean;
    targetArmorClass?: number;
    targetName?: string;
    targetId?: string;
    targetKind?: 'character' | 'entity';
    targetConditions?: string[];
    damageOverride?: string;
    slotLevel?: number;
}

export interface RestIntentPayload {
    restType: 'short' | 'long';
}

export interface DamageIntentTarget {
    kind: 'character' | 'entity';
    name?: string;
    entityId?: string;
    encounterId?: number;
    characterId?: number;
}

export interface DamageIntentPayload {
    source: {
        kind: RollSourceKind;
        name: string;
        index?: string;
        damageType?: string;
    };
    damageFormula: string;
    modifier?: number;
    target: DamageIntentTarget;
}

export interface HealingIntentPayload {
    source: {
        kind: RollSourceKind;
        name: string;
        index?: string;
    };
    healFormula: string;
    modifier?: number;
    target: DamageIntentTarget;
}

export interface TravelIntentPayload {
    targetRegionSlug: string;
    targetPoiSlug?: string;
}

export interface ConsumeItemIntentPayload {
    itemId?: number;
    itemIndex?: string;
    quantity: number;
}

export interface NormalizedSkill {
    index: string;
    name: string;
    ability: string;
    description: string[];
}
