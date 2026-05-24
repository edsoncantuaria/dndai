import type { Character, InventoryItem } from '@/types';
import * as characterUtils from '@/utils/characterUtils';

export const buildItemKey = (item?: InventoryItem) => {
    if (!item) return null;
    const raw = item.id ?? item.index ?? item.name;
    if (!raw) return null;
    return String(raw).toLowerCase();
};

export const mergeInventoryItems = (
    previous: InventoryItem[] | undefined,
    incoming: InventoryItem[],
): InventoryItem[] => {
    const prevMap = new Map<string, InventoryItem>();
    (previous || []).forEach(item => {
        const key = buildItemKey(item) ?? `${Date.now()}-${Math.random()}`;
        prevMap.set(key, item);
    });

    return incoming.map(item => {
        const key = buildItemKey(item) ?? `${Date.now()}-${Math.random()}`;
        const prevItem = prevMap.get(key);
        if (!prevItem) return item;
        return { ...prevItem, ...item };
    });
};

/** Aplica patch parcial do servidor sobre o personagem local (Fase 5/6). */
export function patchCharacter(prev: Character, updates: Partial<Character>): Character {
    const newChar: Character = { ...prev };

    if (updates.level !== undefined) {
        newChar.level = updates.level;
        newChar.proficiencyBonus = characterUtils.getProficiencyBonus(updates.level);
    }
    if (updates.attributes) {
        newChar.attributes = { ...prev.attributes, ...updates.attributes };
    }
    if (updates.hp) {
        newChar.hp = { ...prev.hp, ...updates.hp };
    }
    if ('xp' in updates && updates.xp !== undefined) {
        newChar.xp = updates.xp;
    }
    if (updates.inventory) {
        newChar.inventory = mergeInventoryItems(prev.inventory, updates.inventory as InventoryItem[]);
    }
    if (updates.currency) {
        newChar.currency = { ...(prev.currency || {}), ...updates.currency };
    }
    if (updates.currentWeight !== undefined) {
        newChar.currentWeight = updates.currentWeight;
    }
    if (updates.carryingCapacity !== undefined) {
        newChar.carryingCapacity = updates.carryingCapacity;
    }
    if (!updates.currency && updates.inventory) {
        newChar.currency = characterUtils.calculateCurrency(newChar.inventory ?? prev.inventory);
    }
    if (updates.currentWeight === undefined && updates.inventory) {
        newChar.currentWeight = characterUtils.calculateWeight(newChar.inventory ?? prev.inventory);
    }
    const strengthScore = newChar.attributes?.strength ?? prev.attributes?.strength ?? 10;
    if (updates.carryingCapacity === undefined) {
        newChar.carryingCapacity = characterUtils.calculateCarryingCapacity(strengthScore);
    }
    const modifiers =
        newChar.modifiers ?? prev.modifiers ?? characterUtils.calculateModifiers(newChar.attributes ?? prev.attributes);
    newChar.modifiers = modifiers;
    const inventoryForAc = Array.isArray(newChar.inventory) ? newChar.inventory : [];
    newChar.ac = characterUtils.calculateAC(inventoryForAc, modifiers);

    if (updates.spellSlots) {
        const mergedSlots = { ...prev.spellSlots };
        Object.entries(updates.spellSlots).forEach(([key, slot]) => {
            const prevSlot = mergedSlots[key as keyof typeof mergedSlots];
            const max = Math.max(slot?.max ?? prevSlot?.max ?? 0, prevSlot?.max ?? 0);
            const current = slot?.current ?? prevSlot?.current ?? max;
            mergedSlots[key as keyof typeof mergedSlots] = {
                max,
                current: Math.min(Math.max(current, 0), max),
            };
        });
        newChar.spellSlots = mergedSlots;
    }
    if (updates.spells) {
        newChar.spells = updates.spells as Character['spells'];
    }
    if (updates.classLevelsData) {
        newChar.classLevelsData = updates.classLevelsData;
    }
    if (updates.subclassLevelsData) {
        newChar.subclassLevelsData = updates.subclassLevelsData;
    }
    if (updates.traits) {
        newChar.traits = updates.traits as Character['traits'];
    }
    if (updates.languages) {
        newChar.languages = updates.languages;
    }
    if (updates.personalityTraits) {
        newChar.personalityTraits = updates.personalityTraits;
    }
    if (updates.feats) {
        newChar.feats = updates.feats;
    }
    if (updates.journal) {
        newChar.journal = updates.journal;
    }
    if (updates.relationships) {
        const prevRelationships = prev.relationships || [];
        const relMap = new Map<string, (typeof prevRelationships)[number]>();
        prevRelationships.forEach(rel => {
            const key = rel.npcId || rel.name;
            if (key) relMap.set(key, rel);
        });
        newChar.relationships = updates.relationships.map(rel => {
            const key = rel.npcId || rel.name;
            const existing = key ? relMap.get(key) : null;
            if (!existing) return rel;
            return {
                ...existing,
                ...rel,
                quests: Array.isArray(rel.quests) ? rel.quests : existing.quests || [],
                status: rel.status || existing.status,
            };
        });
    }
    if (updates.worldState) {
        const prevWorld = prev.worldState || {};
        const nextWorld = { ...prevWorld, ...updates.worldState };
        newChar.worldState = {
            ...nextWorld,
            timeOfDay: updates.worldState.timeOfDay || prevWorld.timeOfDay || 'Manhã',
            weather: updates.worldState.weather || prevWorld.weather || 'Ensolarado',
            location: updates.worldState.location || prevWorld.location,
            currentRegion: updates.worldState.currentRegion || prevWorld.currentRegion || 'Desconhecida',
        };
    }
    if (updates.currentRegion) {
        newChar.currentRegion = updates.currentRegion;
    }
    if ('storySoFar' in updates) {
        newChar.storySoFar = updates.storySoFar;
    }
    if (updates.factionReputation) {
        newChar.factionReputation = { ...(prev.factionReputation || {}), ...updates.factionReputation };
    }
    if (updates.ac) {
        newChar.ac = { ...prev.ac, ...updates.ac };
    }
    if (updates.deathSaves) {
        newChar.deathSaves = { ...prev.deathSaves, ...updates.deathSaves };
    }
    if (updates.conditions) {
        newChar.conditions = updates.conditions as Character['conditions'];
    }
    if (updates.hitDice) {
        newChar.hitDice = { ...prev.hitDice, ...updates.hitDice };
    }

    const attributesForCalc = newChar.attributes || prev.attributes;
    const inventoryForCalc = Array.isArray(newChar.inventory) ? newChar.inventory : [];
    const calcModifiers = attributesForCalc
        ? characterUtils.calculateModifiers(attributesForCalc)
        : prev.modifiers;
    const ac = updates.ac ? { ...prev.ac, ...updates.ac } : characterUtils.calculateAC(inventoryForCalc, calcModifiers);
    const currentWeight =
        updates.currentWeight !== undefined
            ? updates.currentWeight
            : characterUtils.calculateWeight(inventoryForCalc);
    const carryingCapacity =
        updates.carryingCapacity !== undefined
            ? updates.carryingCapacity
            : attributesForCalc
              ? characterUtils.calculateCarryingCapacity(attributesForCalc.strength)
              : prev.carryingCapacity;
    const currency = updates.currency
        ? { ...(prev.currency || {}), ...updates.currency }
        : characterUtils.calculateCurrency(inventoryForCalc);
    const xpToNextLevel = characterUtils.getXpThreshold(newChar.level);

    return {
        ...newChar,
        modifiers: calcModifiers,
        ac,
        currentWeight,
        carryingCapacity,
        currency,
        xpToNextLevel,
    };
}
