// utils/characterUtils.ts
import type { Attributes, InventoryItem, ApiClassLevel, ApiClass } from "../types";

// NEW: Centralized single modifier calculation
export const calculateModifier = (score: number): number => {
    return Math.floor((score - 10) / 2);
};

// UPDATED: Use the new single calculator
export const calculateModifiers = (attributes: Attributes): Attributes => {
    const modifiers: Partial<Attributes> = {};
    for (const key in attributes) {
        const attrKey = key as keyof Attributes;
        modifiers[attrKey] = calculateModifier(attributes[attrKey]);
    }
    return modifiers as Attributes;
};

export const getProficiencyBonus = (level: number): number => {
    return Math.ceil(1 + level / 4);
};

export const getXpThreshold = (level: number): number => {
    const thresholds = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
    return thresholds[level] || Infinity;
};

// NEW: Centralized carrying capacity calculation
export const calculateCarryingCapacity = (strength: number): number => {
    return strength * 15;
};

// NEW: Centralized HP calculation for level 1
export const calculateMaxHpAtLevel1 = (hitDie: number, constitutionModifier: number): number => {
    return hitDie + constitutionModifier;
};

export const calculateAC = (inventory: InventoryItem[], modifiers: Attributes): { value: number, source: string } => {
    let baseAc = 10;
    let armorAc = 0;
    let hasShield = false;
    let armorDexBonus = true;
    let maxDexBonus: number | null = null;
    let armorSourceName: string = 'Base';

    const equippedArmors = inventory.filter(i => i.equipped && i.armor_class);
    const equippedShield = inventory.find(i => i.equipped && i.armor_category === 'Shield');

    let bestEquippedArmor: InventoryItem | null = null;
    if (equippedArmors.length > 0) {
        bestEquippedArmor = equippedArmors.reduce((best, current) => {
            return ((current.armor_class?.base || 0) > (best.armor_class?.base || 0)) ? current : best;
        });
    }

    if (bestEquippedArmor && bestEquippedArmor.armor_class) {
        armorAc = Number(bestEquippedArmor.armor_class.base) || 0;
        armorDexBonus = bestEquippedArmor.armor_class.dex_bonus;
        maxDexBonus = bestEquippedArmor.armor_class.max_bonus;
        armorSourceName = bestEquippedArmor.name;
    }

    hasShield = !!equippedShield;

    let dexModifierForAc = Number(modifiers.dexterity) || 0;

    if (armorAc > 0) {
        baseAc = armorAc;
        if (!armorDexBonus) {
            dexModifierForAc = 0;
        } else if (maxDexBonus !== null && maxDexBonus !== undefined) {
            dexModifierForAc = Math.min(dexModifierForAc, Number(maxDexBonus));
        }
    } else {
        baseAc = 10;
    }

    const finalAC = (Number(baseAc) || 10) + dexModifierForAc + (hasShield ? 2 : 0);

    return {
        value: finalAC,
        source: armorSourceName,
    };
};

const getSpellcastingInfoForLevel = (classLevelsData: ApiClassLevel[], level: number): ApiClassLevel['spellcasting'] | undefined => {
    const levelData = classLevelsData.find(l => l.level === level);
    return levelData?.spellcasting;
}

export const getCantripsKnown = (classLevelsData: ApiClassLevel[], level: number): number => {
    const spellcasting = getSpellcastingInfoForLevel(classLevelsData, level);
    return spellcasting?.cantrips_known || 0;
};

// NEW: Centralized logic for spells known calculation
export const getSpellsKnown = (
    level: number,
    classLevelsData: ApiClassLevel[],
    classDetails: ApiClass | null,
    attributes: Attributes
): number => {
    const spellcasting = getSpellcastingInfoForLevel(classLevelsData, level);

    if (!classDetails) return 0;

    // "Spells Known" casters (Bard, Sorcerer, Ranger, Warlock) often have a fixed value in the API data.
    if (spellcasting?.spells_known) {
        return spellcasting.spells_known;
    }

    if (!classDetails.spellcasting) return 0; // Not a spellcaster at this level.

    // For "Prepared" casters, we calculate based on their ability modifier.
    const abilityShort = classDetails.spellcasting.spellcasting_ability.index;
    const ability = ATTRIBUTE_SHORT_MAP[abilityShort] as keyof Attributes;
    const modifier = calculateModifier(attributes[ability]);

    // Specific class rules
    if (classDetails.index === 'wizard' && level === 1) {
        // At level 1, Wizards add 6 spells to their spellbook.
        return 6;
    }
    
    if (classDetails.index === 'paladin') {
        if (level < 2) return 0;
        // They prepare `modifier + half level (rounded down)`.
        return Math.max(1, modifier + Math.floor(level / 2));
    }

    // Default for other prepared casters (Cleric, Druid, and Wizard after level 1)
    return Math.max(1, modifier + level);
};

export const ATTRIBUTE_SHORT_MAP: Record<string, keyof Attributes> = {
    'str': 'strength', 'dex': 'dexterity', 'con': 'constitution',
    'int': 'intelligence', 'wis': 'wisdom', 'cha': 'charisma'
};

export const SKILL_ATTRIBUTE_MAP: Record<string, keyof Attributes> = {
    'Acrobatics': 'dexterity',
    'Animal Handling': 'wisdom',
    'Arcana': 'intelligence',
    'Athletics': 'strength',
    'Deception': 'charisma',
    'History': 'intelligence',
    'Insight': 'wisdom',
    'Intimidation': 'charisma',
    'Investigation': 'intelligence',
    'Medicine': 'wisdom',
    'Nature': 'intelligence',
    'Perception': 'wisdom',
    'Performance': 'charisma',
    'Persuasion': 'charisma',
    'Religion': 'intelligence',
    'Sleight of Hand': 'dexterity',
    'Stealth': 'dexterity',
    'Survival': 'wisdom',
};

export const ALL_SKILLS = Object.keys(SKILL_ATTRIBUTE_MAP);