// utils/characterUtils.ts
import type { Attributes, InventoryItem, ApiClassLevel, ApiClass, NewCharacterInfo, Character, Feat, ApiListItem } from "../types";
import * as DndApiService from '../services/dndApiService';
import { v4 as uuidv4 } from 'uuid';

export const XP_THRESHOLDS: Record<number, number> = {
    1: 300, 2: 900, 3: 2700, 4: 6500, 5: 14000, 6: 23000, 7: 34000, 8: 48000, 9: 64000,
    10: 85000, 11: 100000, 12: 120000, 13: 140000, 14: 165000, 15: 195000, 16: 225000,
    17: 265000, 18: 305000, 19: 355000, 20: Infinity
};

export const PROFICIENCY_BONUS: Record<number, number> = {
    1: 2, 2: 2, 3: 2, 4: 2, 5: 3, 6: 3, 7: 3, 8: 3, 9: 4, 10: 4, 11: 4, 12: 4,
    13: 5, 14: 5, 15: 5, 16: 5, 17: 6, 18: 6, 19: 6, 20: 6
};


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
    return PROFICIENCY_BONUS[level] || 6;
};

export const getXpThreshold = (level: number): number => {
    return XP_THRESHOLDS[level] || Infinity;
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

export const getCantripsKnown = (level1Data?: ApiClassLevel): number => {
    if (!level1Data) return 0;
    const spellcasting = level1Data.spellcasting || level1Data.class_specific;
    return spellcasting?.cantrips_known || 0;
};

// NEW: Centralized logic for spells known calculation
export const getSpellsKnown = (
    level: number,
    level1Data?: ApiClassLevel,
    classDetails?: ApiClass | null,
    attributes?: Attributes,
): number => {
    if (!level1Data || !classDetails || !attributes) return 0;
    
    const spellcastingData = level1Data.spellcasting || level1Data.class_specific;
    if (!spellcastingData || !classDetails.spellcasting) return 0;

    // "Spells Known" casters (Bard, Ranger, Sorcerer, Warlock)
    if (spellcastingData.spells_known) {
        return spellcastingData.spells_known;
    }

    // "Prepared" casters (Cleric, Druid, Paladin, Wizard)
    const abilityShort = classDetails.spellcasting.spellcasting_ability.index;
    const ability = ATTRIBUTE_SHORT_MAP[abilityShort] as keyof Attributes;
    const modifier = calculateModifier(attributes[ability]);

    // Wizard at level 1 adds 6 spells to their spellbook.
    if (classDetails.index === 'wizard' && level === 1) {
        return 6;
    }

    // Cleric, Druid, Paladin (at level 2+), Wizard (after level 1) prepare `modifier + level`
    return Math.max(1, modifier + level);
};


const DRAGON_ANCESTRY_RESISTANCE: Record<string, string> = {
    'draconic-ancestry-black': 'acid',
    'draconic-ancestry-blue': 'lightning',
    'draconic-ancestry-brass': 'fire',
    'draconic-ancestry-bronze': 'lightning',
    'draconic-ancestry-copper': 'acid',
    'draconic-ancestry-gold': 'fire',
    'draconic-ancestry-green': 'poison',
    'draconic-ancestry-red': 'fire',
    'draconic-ancestry-silver': 'cold',
    'draconic-ancestry-white': 'cold',
};

export const initializeNewCharacter = async (info: NewCharacterInfo): Promise<Character> => {
    const modifiers = calculateModifiers(info.attributes);
    const proficiencyBonus = getProficiencyBonus(1);
    const maxHp = calculateMaxHpAtLevel1(info.hitDie, modifiers.constitution);

    const [classLevelsData, subclassLevelsData] = await Promise.all([
        DndApiService.getClassLevels(info.characterClass.toLowerCase()),
        info.subclass ? DndApiService.getSubclassLevels(info.subclass.toLowerCase()) : Promise.resolve(null),
    ]);
    
    const startingGold = 15; // TODO: Derive from background
    
    const damage_resistances = [];
    if(info.draconicAncestry && DRAGON_ANCESTRY_RESISTANCE[info.draconicAncestry]){
        damage_resistances.push(DRAGON_ANCESTRY_RESISTANCE[info.draconicAncestry]);
    }


    const newCharacter: Character = {
        name: info.name,
        sex: info.sex,
        hairStyle: info.hairStyle,
        beardStyle: info.beardStyle,
        skinColor: info.skinColor,
        level: 1,
        xp: 0,
        xpToNextLevel: getXpThreshold(1),
        race: info.race,
        subrace: info.subrace,
        draconicAncestry: info.draconicAncestry,
        characterClass: info.characterClass,
        subclass: info.subclass,
        hitDie: info.hitDie,
        background: info.background,
        alignment: info.alignment,
        attributes: info.attributes,
        modifiers,
        proficiencyBonus,
        proficiencies: info.proficiencies,
        traits: info.traits, // Added traits here
        languages: info.languages,
        damage_resistances,
        hp: { current: maxHp, max: maxHp, temp: 0 },
        ac: calculateAC(info.inventory, modifiers),
        inventory: info.inventory.map(item => ({...item, id: uuidv4(), equipped: false })),
        currency: { gp: startingGold, sp: 0, cp: 0 },
        currentWeight: info.inventory.reduce((sum, item) => sum + (item.weight || 0) * item.quantity, 0),
        carryingCapacity: calculateCarryingCapacity(info.attributes.strength),
        spellSlots: {},
        spells: info.spells,
        feats: info.feats as Feat[],
        backstory: info.backstory,
        storySoFar: '',
        personalityTraits: info.personalityTraits,
        ideal: info.ideal,
        bond: info.bond,
        flaw: info.flaw,
        deathSaves: { successes: 0, failures: 0 },
        conditions: [],
        relationships: [],
        journal: [],
        currentRegion: 'Desconhecida',
        hitDice: { current: 1, total: 1 },
        speed: (await DndApiService.getRaceDetails(info.race.toLowerCase()))?.speed || 30,
        classLevelsData: classLevelsData || [],
        subclassLevelsData: subclassLevelsData || [],
        factionReputation: {},
        worldState: {
            timeOfDay: 'Manhã',
            weather: 'Céu Limpo'
        },
    };
    
    // Populate initial spell slots if any
    const level1Data = newCharacter.classLevelsData.find(l => l.level === 1);
    const spellcastingDataSource = level1Data?.spellcasting || level1Data?.class_specific;

    if (spellcastingDataSource) {
        Object.keys(spellcastingDataSource).forEach(key => {
            if (key.startsWith('spell_slots_level_')) {
                const level = key.replace('spell_slots_level_', '');
                const max = spellcastingDataSource[key as keyof typeof spellcastingDataSource] as number;
                if (max > 0) {
                    newCharacter.spellSlots[`level${level}`] = { current: max, max: max };
                }
            }
        });
    }

    return newCharacter;
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

export const applyLevelUp = async (character: Character, levelUpState: any, selections: any): Promise<Character> => {
    // This is a placeholder for a much more complex function.
    // In a real scenario, this would involve:
    // - Increasing HP (either by rolling or taking average)
    // - Adding new features from class/subclass
    // - Handling Ability Score Increases or Feats
    // - Updating spell slots and known/prepared spells
    console.log("Applying level up with selections:", selections);
    const newCharacter = { ...character };

    // Placeholder Logic:
    newCharacter.level = levelUpState.newLevel;
    newCharacter.xpToNextLevel = getXpThreshold(newCharacter.level);
    newCharacter.proficiencyBonus = getProficiencyBonus(newCharacter.level);
    
    const constitutionModifier = newCharacter.modifiers.constitution;
    const hpIncrease = selections.hpIncrease ?? (Math.floor(newCharacter.hitDie / 2) + 1) + constitutionModifier;
    newCharacter.hp.max += hpIncrease;
    newCharacter.hp.current += hpIncrease;

    if (selections.attributes) {
        for (const attr in selections.attributes) {
            const key = attr as keyof Attributes;
            newCharacter.attributes[key] += selections.attributes[key] || 0;
        }
        newCharacter.modifiers = calculateModifiers(newCharacter.attributes);
    }
    
    if (selections.spells) {
        newCharacter.spells = [...new Set([...newCharacter.spells, ...selections.spells])];
    }
    
    // ... and so on for features, etc.
    
    return newCharacter;
};
