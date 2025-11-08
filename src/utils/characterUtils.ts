// utils/characterUtils.ts
import type { Attributes, InventoryItem, ApiClassLevel, ApiClass, NewCharacterInfo, Character, Feat, ApiListItem, ApiTrait, CharacterAttributes, CharacterProficiency, CharacterSpell, JournalEntry, Relationship, ApiCondition, ApiSubrace } from "../types";
import * as DndApiService from '../services/dndApiService';
import { v4 as uuidv4 } from 'uuid';
import { calculateTotalValueInCP, COIN_TYPES, COIN_WEIGHT } from './currency';


export const XP_THRESHOLDS: Record<number, number> = {
    1: 300, 2: 900, 3: 2700, 4: 6500, 5: 14000, 6: 23000, 7: 34000, 8: 48000, 9: 64000,
    10: 85000, 11: 100000, 12: 120000, 13: 140000, 14: 165000, 15: 195000, 16: 225000,
    17: 265000, 18: 305000, 19: 355000, 20: Infinity
};

export const PROFICIENCY_BONUS: Record<number, number> = {
    1: 2, 2: 2, 3: 2, 4: 2, 5: 3, 6: 3, 7: 3, 8: 3, 9: 4, 10: 4, 11: 4, 12: 4,
    13: 5, 14: 5, 15: 5, 16: 5, 17: 6, 18: 6, 19: 6, 20: 6
};

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
    const currency: Character['currency'] = { gp: 0, sp: 0, cp: 0, ep: 0, pp: 0 };
    if (!Array.isArray(inventory)) return currency;

    inventory.forEach(item => {
        if (COIN_TYPES.includes(item.index)) {
            const coinType = item.index as keyof typeof currency;
            currency[coinType] = (currency[coinType] || 0) + item.quantity;
        }
    });
    return currency;
};

export const calculateWeight = (inventory: InventoryItem[]): number => {
    if (!Array.isArray(inventory)) {
        console.warn("calculateWeight received a non-array inventory:", inventory);
        return 0;
    }

    let totalCoinCount = 0;
    
    const itemWeight = inventory.reduce((sum, item) => {
        if (COIN_TYPES.includes(item.index)) {
            totalCoinCount += item.quantity;
            return sum;
        }
        const itemWeight = item?.weight || 0;
        const itemQuantity = item?.quantity || 1;
        return sum + (itemWeight * itemQuantity);
    }, 0);
    
    const coinWeight = totalCoinCount * COIN_WEIGHT;

    return itemWeight + coinWeight;
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
    const equippedShield = inventory.find(i => i.equipped && i.equipment_category?.index === 'shields');

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
    
    const rawClassLevels = await DndApiService.getClassLevels(backendChar.characterClass.toLowerCase());
    const classLevelsData = Array.isArray(rawClassLevels) ? rawClassLevels : (rawClassLevels as any)?.results || Object.values(rawClassLevels || {});
      
    const rawSubclassLevels = classDetails?.subclasses?.[0] ? await DndApiService.getSubclassLevels(classDetails.subclasses[0].index) : [];
    const subclassLevelsData = Array.isArray(rawSubclassLevels) ? rawSubclassLevels : (rawSubclassLevels as any)?.results || Object.values(rawSubclassLevels || {});
    
    const backendAttributes = backendChar.attributes ?? {};
    const defaultAbilityScore = 10;
    const attributes: CharacterAttributes = {
        strength: backendAttributes.strength ?? defaultAbilityScore,
        dexterity: backendAttributes.dexterity ?? defaultAbilityScore,
        constitution: backendAttributes.constitution ?? defaultAbilityScore,
        intelligence: backendAttributes.intelligence ?? defaultAbilityScore,
        wisdom: backendAttributes.wisdom ?? defaultAbilityScore,
        charisma: backendAttributes.charisma ?? defaultAbilityScore,
        id: backendAttributes.id ?? backendChar.id ?? 0,
        characterId: backendAttributes.characterId ?? backendChar.id ?? 0,
    };
    
    const modifiers = calculateModifiers(attributes);
    const proficiencyBonus = getProficiencyBonus(backendChar.level);
    
    const inventory: InventoryItem[] = Array.isArray(backendChar.items)
        ? backendChar.items.map((item: any) => ({
              ...item.itemData,
              id: item.id.toString(),
              quantity: item.quantity,
              equipped: item.equipped,
          }))
        : [];
    
    const ac = calculateAC(inventory, modifiers);
    const maxHp = backendAttributes.maxHp || backendAttributes.hp || calculateMaxHpAtLevel1(classDetails?.hit_die || 8, modifiers.constitution);

    const traits: ApiListItem[] = [...(raceDetails?.traits || [])];
    if (subraceDetails && subraceDetails.racial_traits) {
        traits.push(...subraceDetails.racial_traits);
    }
    
    const baseLanguages = new Set(raceDetails?.languages.map(l => l.name) || []);
    if(subraceDetails && subraceDetails.languages) {
        subraceDetails.languages.forEach(l => baseLanguages.add(l.name));
    }
    const characterLanguages = new Set(backendChar.languages || []); 
    const languages = Array.from(new Set([...baseLanguages, ...characterLanguages]));


    const proficiencies = backendChar.proficiencies.map((p: any) => ({
        index: p.name.toLowerCase().replace(/ /g, '-'),
        ...p
    }));

    // --- Correct Spell Slot Calculation ---
    const spellSlots: Character['spellSlots'] = {};
    let relevantSpellcastingData = null;

    // Look backwards from the current level to find the most recent spellcasting data
    for (let i = backendChar.level; i >= 1; i--) {
        const levelData = classLevelsData.find(l => l.level === i);
        if (levelData?.spellcasting) {
            relevantSpellcastingData = levelData.spellcasting;
            break;
        }
        // Check subclass levels too, which is crucial for Paladin, Ranger, etc.
        const sublevelData = subclassLevelsData.find(l => l.level === i);
        if (sublevelData?.spellcasting) {
            relevantSpellcastingData = sublevelData.spellcasting;
            break;
        }
    }
    
    if (relevantSpellcastingData) {
        for (let i = 1; i <= 9; i++) {
            const slotKey = `spell_slots_level_${i}` as keyof typeof relevantSpellcastingData;
            if (relevantSpellcastingData[slotKey] && relevantSpellcastingData[slotKey] > 0) {
                const currentSlots = (backendChar.spellSlots && backendChar.spellSlots[`level${i}`]) 
                    ? backendChar.spellSlots[`level${i}`].current 
                    : relevantSpellcastingData[slotKey];
                
                spellSlots[`level${i}`] = {
                    max: relevantSpellcastingData[slotKey] as number,
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
        hp: { current: backendAttributes.hp || maxHp, max: maxHp, temp: 0 },
        ac: ac,
        xp: backendChar.xp || 0,
        xpToNextLevel: getXpThreshold(backendChar.level),
        hitDie: classDetails?.hit_die || 8,
        hitDice: { current: backendChar.level, total: backendChar.level },
        speed: raceDetails?.speed || 30,
        deathSaves: { successes: 0, failures: 0 },
        conditions: (backendAttributes.conditions || []) as ApiCondition[],
        currency: calculateCurrency(inventory),
        currentWeight: calculateWeight(inventory),
        carryingCapacity: calculateCarryingCapacity(attributes.strength),
        traits: traits,
        classLevelsData: classLevelsData,
        subclassLevelsData: subclassLevelsData,
        spellSlots: spellSlots,
        personalityTraits: backendChar.personalityTraits || [],
        subclassFlavor: backendChar.subclassFlavor || classDetails?.subclasses?.[0]?.name || null
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

export const applyLevelUp = async (character: Character, levelUpState: LevelUpState, selections: LevelUpSelections): Promise<Character> => {
    console.log("Applying level up with selections:", selections);
    const newCharacter = { ...character };

    newCharacter.level = levelUpState.newLevel;
    newCharacter.xpToNextLevel = getXpThreshold(newCharacter.level);
    newCharacter.proficiencyBonus = getProficiencyBonus(newCharacter.level);
    
    const constitutionModifier = newCharacter.modifiers.constitution;
    const hpIncrease = selections.hpIncrease ?? (Math.floor(newCharacter.hitDie / 2) + 1) + constitutionModifier;
    newCharacter.hp.max += hpIncrease;
    newCharacter.hp.current = newCharacter.hp.max; // Full heal on level up

    if (selections.attributes) {
        for (const attr in selections.attributes) {
            const key = attr as keyof Attributes;
            newCharacter.attributes[key] += selections.attributes[key] || 0;
        }
        newCharacter.modifiers = calculateModifiers(newCharacter.attributes);
    }
    
    if (selections.spells) {
        const newSpells: CharacterSpell[] = selections.spells.map(spellName => ({
            id: 0, // O backend irá gerar
            characterId: newCharacter.id,
            spellName: spellName,
        }));
        newCharacter.spells = [...newCharacter.spells, ...newSpells];
    }
    
    return newCharacter;
};
