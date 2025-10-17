// src/hooks/character-creation/useAttributeManager.ts
import { useCallback } from 'react';
import type { Attributes } from '@/types';
import type { CharacterCreatorState, CharacterCreatorAction } from './reducer';
import { getCostForScore, getPointsForScore, rollAttribute } from '@/utils/creationHelpers';

const attributeSuggestions: Record<string, (keyof Attributes)[]> = {
    'barbarian': ['strength', 'constitution', 'dexterity', 'wisdom', 'charisma', 'intelligence'],
    'bard': ['charisma', 'dexterity', 'constitution', 'wisdom', 'intelligence', 'strength'],
    'cleric': ['wisdom', 'constitution', 'strength', 'charisma', 'dexterity', 'intelligence'],
    'druid': ['wisdom', 'constitution', 'dexterity', 'intelligence', 'charisma', 'strength'],
    'fighter': ['strength', 'constitution', 'dexterity', 'wisdom', 'charisma', 'intelligence'],
    'monk': ['dexterity', 'wisdom', 'constitution', 'strength', 'charisma', 'intelligence'],
    'paladin': ['strength', 'charisma', 'constitution', 'wisdom', 'dexterity', 'intelligence'],
    'ranger': ['dexterity', 'wisdom', 'constitution', 'strength', 'intelligence', 'charisma'],
    'rogue': ['dexterity', 'charisma', 'constitution', 'wisdom', 'intelligence', 'strength'],
    'sorcerer': ['charisma', 'constitution', 'dexterity', 'wisdom', 'intelligence', 'strength'],
    'warlock': ['charisma', 'constitution', 'dexterity', 'wisdom', 'intelligence', 'strength'],
    'wizard': ['intelligence', 'constitution', 'dexterity', 'wisdom', 'charisma', 'strength'],
};

export const useAttributeManager = (state: CharacterCreatorState, dispatch: React.Dispatch<CharacterCreatorAction>) => {
    const { baseAttributes, points, characterClass } = state;

    const handleAttributeChange = useCallback((attr: keyof Attributes, delta: 1 | -1) => {
        const currentScore = baseAttributes[attr];
        let newScore = currentScore + delta;
        if (newScore > 15 || newScore < 8) return;

        const oldPoints = getPointsForScore(currentScore);
        const newPoints = getPointsForScore(newScore);
        const cost = newPoints - oldPoints;
        
        if (points - cost >= 0) {
            dispatch({ type: 'SET_POINTS', payload: points - cost });
            dispatch({ type: 'SET_BASE_ATTRIBUTES', payload: { ...baseAttributes, [attr]: newScore } });
        }
    }, [baseAttributes, points, dispatch]);

    const handleRollAttributes = useCallback(() => {
        const newAttributes = {
            strength: rollAttribute(),
            dexterity: rollAttribute(),
            constitution: rollAttribute(),
            intelligence: rollAttribute(),
            wisdom: rollAttribute(),
            charisma: rollAttribute(),
        };
        dispatch({ type: 'SET_BASE_ATTRIBUTES', payload: newAttributes });
    }, [dispatch]);

    const handleSuggestAttributes = useCallback(() => {
        if (!characterClass) return;
        const suggestedOrder = attributeSuggestions[characterClass];
        if (!suggestedOrder) return;

        const standardArray = [15, 14, 13, 12, 10, 8];
        const newAttributes: Partial<Attributes> = {};
        suggestedOrder.forEach((attr, index) => {
            newAttributes[attr] = standardArray[index];
        });
        
        const totalCost = Object.values(newAttributes).reduce((sum, score) => sum + getPointsForScore(score as number), 0);

        dispatch({ type: 'SET_BASE_ATTRIBUTES', payload: newAttributes as Attributes });
        dispatch({ type: 'SET_POINTS', payload: 27 - totalCost });
    }, [characterClass, dispatch]);

    return {
        handleAttributeChange,
        handleRollAttributes,
        handleSuggestAttributes,
    };
};
