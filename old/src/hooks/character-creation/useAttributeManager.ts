// src/hooks/character-creation/useAttributeManager.ts
import { useCallback, useState } from 'react';
import type { Attributes } from '@/types';
import type { CharacterCreatorState, CharacterCreatorAction } from './reducer';
import { getCostForScore, getPointsForScore } from '@/utils/creationHelpers';
import { rollCharacterAttributes } from '@/services/characterCreationService';

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

export const useAttributeManager = (
    state: CharacterCreatorState,
    dispatch: React.Dispatch<CharacterCreatorAction>,
    setField: (field: keyof CharacterCreatorState, value: unknown) => void,
) => {
    const { baseAttributes, points, characterClass } = state;
    const [isRollingAttributes, setIsRollingAttributes] = useState(false);
    const [rollError, setRollError] = useState<string | null>(null);

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

    const handleRollAttributes = useCallback(async () => {
        setIsRollingAttributes(true);
        setRollError(null);
        try {
            const result = await rollCharacterAttributes();
            dispatch({ type: 'SET_BASE_ATTRIBUTES', payload: result.baseAttributes });
            setField('rollSessionId', result.rollSessionId);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Não foi possível rolar os atributos.';
            setRollError(message);
        } finally {
            setIsRollingAttributes(false);
        }
    }, [dispatch, setField]);

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
        setField('rollSessionId', null);
    }, [characterClass, dispatch, setField]);

    return {
        handleAttributeChange,
        handleRollAttributes,
        handleSuggestAttributes,
        isRollingAttributes,
        rollError,
    };
};
