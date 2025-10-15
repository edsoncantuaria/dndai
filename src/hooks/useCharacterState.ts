// src/hooks/useCharacterState.ts
import { useState, useCallback } from 'react';
import type { Character, Attributes, InventoryItem, Relationship, JournalEntry, LevelUpState, LevelUpSelections, LogEntry } from '../types';
import * as characterUtils from '../utils/characterUtils';
import { v4 as uuidv4 } from 'uuid';

// Helper functions for merging state
const mergeJournalEntries = (existing: JournalEntry[], updates: JournalEntry[]): JournalEntry[] => {
    if (!updates) return existing;
    const newJournal = [...existing];
    const existingMap = new Map(newJournal.map(entry => [entry.id, entry]));
    for (const update of updates) {
        if (existingMap.has(update.id)) {
            const existingEntry = existingMap.get(update.id)!;
            Object.assign(existingEntry, { ...update, subLocations: update.subLocations ? mergeJournalEntries(existingEntry.subLocations || [], update.subLocations) : existingEntry.subLocations });
        } else {
            newJournal.push(update);
            existingMap.set(update.id, update);
        }
    }
    return newJournal;
};

const mergeRelationships = (existing: Relationship[], updates: Relationship[]): Relationship[] => {
    if (!updates) return existing;
    const newRelationships = [...existing];
    const existingMap = new Map(newRelationships.map(rel => [rel.npcId, rel]));
    for (const update of updates) {
        if (existingMap.has(update.npcId)) {
            const existingRel = existingMap.get(update.npcId)!;
            Object.assign(existingRel, update);
        } else {
            newRelationships.push(update);
            existingMap.set(update.npcId, update);
        }
    }
    return newRelationships;
};


const mergeCharacterState = (oldChar: Character, updates: Partial<Character>): Character => {
    let newChar: Character = { ...oldChar, ...updates };

    if (updates.inventory) {
        newChar.inventory = updates.inventory;
        newChar.currency = characterUtils.calculateCurrency(newChar.inventory);
        newChar.currentWeight = characterUtils.calculateWeight(newChar.inventory);
    }
    if (updates.spells) newChar.spells = updates.spells;
    if (updates.conditions) newChar.conditions = updates.conditions;
    if (updates.journal) newChar.journal = mergeJournalEntries(oldChar.journal || [], updates.journal);
    if (updates.relationships) newChar.relationships = mergeRelationships(oldChar.relationships || [], updates.relationships);
    if (updates.factionReputation) newChar.factionReputation = { ...(oldChar.factionReputation || {}), ...updates.factionReputation };
    if (updates.worldState) newChar.worldState = { ...(oldChar.worldState || {}), ...updates.worldState };
    
    newChar.attributes = { ...oldChar.attributes, ...updates.attributes };
    newChar.hp = { ...oldChar.hp, ...updates.hp };
    newChar.deathSaves = { ...oldChar.deathSaves, ...updates.deathSaves };
    newChar.ac = { ...oldChar.ac, ...updates.ac };
    newChar.hitDice = { ...oldChar.hitDice, ...updates.hitDice };
    newChar.spellSlots = { ...oldChar.spellSlots, ...updates.spellSlots };

    if (updates.attributes) {
        const newModifiers = characterUtils.calculateModifiers(newChar.attributes);
        newChar.modifiers = newModifiers;
        newChar.ac = characterUtils.calculateAC(newChar.inventory, newModifiers);
        newChar.carryingCapacity = characterUtils.calculateCarryingCapacity(newChar.attributes.strength);
    }

    return newChar;
};


export const useCharacterState = () => {
    const [character, setCharacter] = useState<Character | null>(null);

    const updateCharacter = useCallback((updates: Partial<Character>) => {
        setCharacter(prev => prev ? mergeCharacterState(prev, updates) : null);
    }, []);

    const clearCharacterState = useCallback(() => {
        setCharacter(null);
    }, []);
    
    const handleApplyLevelUp = useCallback((
        levelUpState: LevelUpState | null,
        addLogEntry: (entry: any) => void,
        clearRequest: (type: 'levelUp') => void,
        setActionOptions: (options: any[]) => void
    ) => async (selections: LevelUpSelections) => {
        if (!character || !levelUpState || !levelUpState.isPending) return;
        const updatedChar = await characterUtils.applyLevelUp(character, levelUpState, selections);
        setCharacter(updatedChar);
        clearRequest('levelUp');
        addLogEntry({ id: uuidv4(), type: 'system', content: `Parabéns! Você alcançou o nível ${levelUpState.newLevel}!` });
        setActionOptions([]);
    }, [character]);

    const handleToggleEquipped = useCallback((processPlayerAction: (action: string) => void) => (itemId: string) => {
        if (!character) return;
        const item = character.inventory.find(i => i.id === itemId);
        if (!item) return;
        processPlayerAction(item.equipped ? `Eu desequipo meu ${item.name}.` : `Eu equipo meu ${item.name}.`);
    }, [character]);

    const handleUseConsumable = useCallback((processPlayerAction: (action: string) => void) => (itemId: string) => {
        if (!character) return;
        const item = character.inventory.find(i => i.id === itemId);
        if (!item) return;
        processPlayerAction(`Eu uso meu ${item.name}.`);
    }, [character]);

    const handleSpendHitDice = useCallback((processPlayerAction: (action: string) => void) => (diceCount: number) => {
        if (!character) return;
        processPlayerAction(`Eu gasto ${diceCount} dado(s) de vida para me curar.`);
    }, [character]);


    return {
        character,
        setCharacter,
        updateCharacter,
        clearCharacterState,
        handleApplyLevelUp,
        handleToggleEquipped,
        handleUseConsumable,
        handleSpendHitDice,
    };
};
