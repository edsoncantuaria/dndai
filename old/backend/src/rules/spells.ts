// backend/src/rules/spells.ts
import { listSrdResources, getSrdResource } from '../services/srdCatalogService.js';
import type { Ability, RulesCharacterSnapshot, RollResourceCost } from './types.js';
import { abilityModifier, getAbilityScore } from './utils.js';

export interface NormalizedSpellComponent {
    verbal: boolean;
    somatic: boolean;
    material: boolean;
    materialDesc?: string | null;
}

export interface NormalizedSpell {
    index: string;
    name: string;
    level: number;
    school: string;
    castingTime: string;
    range: string;
    duration: string;
    concentration: boolean;
    ritual: boolean;
    components: NormalizedSpellComponent;
    classes: string[];
    subclasses: string[];
    description: string[];
    higherLevels: string[];
    damage?: {
        type?: string;
        dice?: string;
        scaling?: Record<string, string>;
    };
    save?: string;
    areaOfEffect?: { type: string; size: number };
}

export async function getNormalizedSpell(index: string): Promise<NormalizedSpell | null> {
    const spell = await getSrdResource('spells', index);
    if (!spell) return null;
    return normalizeSpell(spell);
}

export async function listNormalizedSpells(): Promise<NormalizedSpell[]> {
    const spells = await listSrdResources('spells');
    return spells.map(normalizeSpell);
}

const getSpellSlotResourceKey = (level: number) => `level-${level}`;

export function ensureSpellSlotAvailability(character: RulesCharacterSnapshot, slotLevel: number): {
    available: boolean;
    remaining: number;
} {
    const key = getSpellSlotResourceKey(slotLevel);
    const resource = character.resources?.find(res => res.type === 'spell-slot' && res.key === key);
    if (!resource) {
        return { available: false, remaining: 0 };
    }
    return { available: resource.current > 0, remaining: resource.current };
}

export function buildSpellSlotCost(level: number, amount = 1): RollResourceCost {
    return {
        kind: 'spell-slot',
        level,
        amount,
        resourceKey: getSpellSlotResourceKey(level),
    };
}

export function getSpellSaveDc(character: RulesCharacterSnapshot, ability: Ability): number {
    const mod = abilityModifier(getAbilityScore(character, ability));
    return 8 + character.proficiencyBonus + mod;
}

export function getSpellAttackBonus(character: RulesCharacterSnapshot, ability: Ability): number {
    const mod = abilityModifier(getAbilityScore(character, ability));
    return mod + character.proficiencyBonus;
}

function normalizeSpell(spell: any): NormalizedSpell {
    const components = spell.components || [];
    const componentSet = new Set(components);
    const componentData: NormalizedSpellComponent = {
        verbal: componentSet.has('V'),
        somatic: componentSet.has('S'),
        material: componentSet.has('M'),
        materialDesc: spell.material,
    };

    return {
        index: spell.index,
        name: spell.name,
        level: spell.level,
        school: spell.school?.name ?? spell.school,
        castingTime: spell.casting_time,
        range: spell.range,
        duration: spell.duration,
        concentration: Boolean(spell.concentration),
        ritual: Boolean(spell.ritual),
        components: componentData,
        classes: (spell.classes ?? []).map((cls: any) => cls.index),
        subclasses: (spell.subclasses ?? []).map((sc: any) => sc.index),
        description: spell.desc ?? [],
        higherLevels: spell.higher_level ?? [],
        damage: normalizeSpellDamage(spell.damage),
        save: spell.dc?.dc_type?.index ?? null,
        areaOfEffect: spell.area_of_effect
            ? {
                  type: spell.area_of_effect.type,
                  size: spell.area_of_effect.size,
              }
            : undefined,
    };
}

function normalizeSpellDamage(damage: any) {
    if (!damage) return undefined;
    const baseDamage = damage.damage_type?.name;
    const damageAtSlotLevel = damage.damage_at_slot_level ?? damage.damage_at_character_level;
    return {
        type: baseDamage,
        dice: damage.damage_dice,
        scaling: damageAtSlotLevel,
    };
}
