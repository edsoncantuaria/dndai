// utils/characterUtils.ts
import type { Attributes, InventoryItem, ApiClassLevel, ApiClass, NewCharacterInfo, Character, Feat, ApiListItem, ApiTrait, CharacterAttributes, CharacterProficiency, CharacterSpell, JournalEntry, Relationship, ApiCondition, ApiSubrace } from "../types";
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

// Standard D&D 5e rule: 50 coins weigh 1 pound.
export const COIN_WEIGHT = 0.02;

export const COIN_TYPES = ['gp', 'sp', 'cp', 'ep', 'pp'];


export const calculateModifier = (score: number): number => {
    return Math.floor((score - 10) / 2);
};

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

export const calculateCarryingCapacity = (strength: number): number => {
    return strength * 15;
};

export const calculateCurrency = (inventory: InventoryItem[]): Character['currency'] => {
    const currency: Character['currency'] = { gp: 0, sp: 0, cp: 0 };
    inventory.forEach(item => {
        if (COIN_TYPES.includes(item.index)) {
            currency[item.index as keyof typeof currency] = (currency[item.index as keyof typeof currency] || 0) + item.quantity;
        }
    });
    return currency;
};

export const calculateWeight = (inventory: InventoryItem[]): number => {
    // Return early if inventory is not an array
    if (!Array.isArray(inventory)) {
        console.warn("calculateWeight received a non-array inventory:", inventory);
        return 0;
    }
    return inventory.reduce((sum, item) => {
        // All coins weigh 0.02 lbs each
        if (COIN_TYPES.includes(item?.index)) {
            return sum + ((item?.quantity || 0) * COIN_WEIGHT);
        }
        return sum + ((item?.weight || 0) * (item?.quantity || 1));
    }, 0);
}


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

export const getSpellsKnown = (
    level: number,
    level1Data?: ApiClassLevel,
    classDetails?: ApiClass | null,
    attributes?: Attributes,
): number => {
    if (!level1Data || !classDetails || !attributes) return 0;
    
    const spellcastingDataSource = level1Data.spellcasting || level1Data.class_specific;
    if (!spellcastingDataSource || !classDetails.spellcasting) return 0;

    if (spellcastingDataSource.spells_known) {
        return spellcastingDataSource.spells_known;
    }

    const abilityShort = classDetails.spellcasting.spellcasting_ability.index;
    const ability = ATTRIBUTE_SHORT_MAP[abilityShort] as keyof Attributes;
    const modifier = calculateModifier(attributes[ability]);

    if (classDetails.index === 'wizard' && level === 1) {
        return 6;
    }

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

export const buildFrontendCharacter = async (backendChar: any): Promise<Character> => {
    let subraceDetails: ApiSubrace | null = null;
    
    const [raceDetails, classDetails] = await Promise.all([
        DndApiService.getRaceDetails(backendChar.race.toLowerCase()),
        DndApiService.getClassDetails(backendChar.characterClass.toLowerCase()),
    ]);
    
    if (backendChar.subrace) {
        const subraceIndex = backendChar.subrace.toLowerCase().replace(/\s+/g, '-');
        subraceDetails = await DndApiService.getSubraceDetails(subraceIndex);
    }
    
    const classLevelsData = await DndApiService.getClassLevels(backendChar.characterClass.toLowerCase()) || [];
    const subclassLevelsData = subraceDetails ? (await DndApiService.getSubclassLevels(subraceDetails.index) || []) : [];
    
    const attributes: CharacterAttributes = {
        strength: backendChar.attributes.strength,
        dexterity: backendChar.attributes.dexterity,
        constitution: backendChar.attributes.constitution,
        intelligence: backendChar.attributes.intelligence,
        wisdom: backendChar.attributes.wisdom,
        charisma: backendChar.attributes.charisma,
        id: backendChar.attributes.id,
        characterId: backendChar.attributes.characterId,
    };
    
    const modifiers = calculateModifiers(attributes);
    const proficiencyBonus = getProficiencyBonus(backendChar.level);
    
    // CORREÇÃO: Garante que `backendChar.inventory` seja tratado como um array.
    const inventory: InventoryItem[] = Array.isArray(backendChar.inventory)
        ? backendChar.inventory.map((item: any) => ({
              ...item, // O backend já está enviando o `itemData` no objeto do inventário
              id: item.id.toString(),
          }))
        : [];
    
    const ac = calculateAC(inventory, modifiers);
    const maxHp = backendChar.attributes.hp || calculateMaxHpAtLevel1(classDetails?.hit_die || 8, modifiers.constitution);

    const traits: ApiListItem[] = [...(raceDetails?.traits || [])];
    if (subraceDetails && subraceDetails.racial_traits) {
        traits.push(...subraceDetails.racial_traits);
    }
    
    const baseLanguages = new Set(raceDetails?.languages.map(l => l.name) || []);
    if(subraceDetails && subraceDetails.languages) {
        subraceDetails.languages.forEach(l => baseLanguages.add(l.name));
    }
    // Assumes languages are stored as a simple array of strings on the character object
    const characterLanguages = new Set(backendChar.languages || []); 
    const languages = Array.from(new Set([...baseLanguages, ...characterLanguages]));


    const proficiencies = backendChar.proficiencies.map((p: any) => ({
        index: p.name.toLowerCase().replace(/ /g, '-'),
        ...p
    }));

    const spellSlots: Character['spellSlots'] = {};
    const levelData = classLevelsData.find(l => l.level === backendChar.level);
    if (levelData?.spellcasting) {
        for (let i = 1; i <= 9; i++) {
            const slotKey = `spell_slots_level_${i}` as keyof typeof levelData.spellcasting;
            if (levelData.spellcasting[slotKey]) {
                const currentSlots = (backendChar.spellSlots && backendChar.spellSlots[`level${i}`]) 
                    ? backendChar.spellSlots[`level${i}`].current 
                    : levelData.spellcasting[slotKey];
                
                spellSlots[`level${i}`] = {
                    max: levelData.spellcasting[slotKey] as number,
                    current: currentSlots as number,
                };
            }
        }
    }

    return {
        ...backendChar,
        attributes: attributes,
        inventory: inventory,
        spells: backendChar.spells || [],
        proficiencies,
        languages,
        relationships: (backendChar.relationships || []).map((r: any) => ({
            ...r,
            quests: r.quests || []
        })),
        modifiers,
        proficiencyBonus,
        hp: { current: backendChar.attributes.hp || maxHp, max: maxHp, temp: 0 },
        ac: ac,
        xp: backendChar.xp || 0,
        xpToNextLevel: getXpThreshold(backendChar.level),
        hitDie: classDetails?.hit_die || 8,
        hitDice: { current: backendChar.level, total: backendChar.level },
        speed: raceDetails?.speed || 30,
        deathSaves: { successes: 0, failures: 0 },
        conditions: (backendChar.attributes.conditions || []) as ApiCondition[],
        currency: calculateCurrency(inventory),
        currentWeight: calculateWeight(inventory),
        carryingCapacity: calculateCarryingCapacity(attributes.strength),
        traits: traits,
        classLevelsData: classLevelsData,
        subclassLevelsData: subclassLevelsData,
        spellSlots: spellSlots,
        personalityTraits: backendChar.personalityTraits || [],
    };
}


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
    console.log("Applying level up with selections:", selections);
    const newCharacter = { ...character };

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
        // This is simplified. Should handle actual spell objects.
        // newCharacter.spells = [...new Set([...newCharacter.spells, ...selections.spells])];
    }
    
    return newCharacter;
};
