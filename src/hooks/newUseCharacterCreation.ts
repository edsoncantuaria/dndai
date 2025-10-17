// hooks/newUseCharacterCreation.ts
import { useReducer, useMemo, useCallback } from 'react';
import { characterCreatorReducer, initialState } from './character-creation/reducer';
import { useAttributeManager } from './character-creation/useAttributeManager';
import { useDataManager } from './character-creation/useDataManager';
import { useSelectionManager } from './character-creation/useSelectionManager';
import { useDerivedCharacterData } from './character-creation/useDerivedCharacterData';
import * as characterUtils from '../utils/characterUtils';
import * as DndApiService from '../services/dndApiService';
import type { NewCharacterInfo, Proficiency, InventoryItem, ApiListItem, Feat, ApiTrait, ApiSpell } from '../types';

export type { ProficiencyChoiceWithSource, EquipmentChoiceGroup } from './useCharacterCreator';

export const useNewCharacterCreation = ({ allLanguages }: { allLanguages: ApiListItem[] }) => {
    const [state, dispatch] = useReducer(characterCreatorReducer, initialState);

    const setField = useCallback((field: keyof typeof state, value: any) => {
        dispatch({ type: 'SET_FIELD', payload: { field, value } });
    }, []);

    const { details, loadingStates, fetchFeats } = useDataManager(state.race, state.subrace, state.characterClass, state.background);
    const { raceDetails, classDetails, backgroundDetails } = details;

    const attributeManager = useAttributeManager(state, dispatch);
    const selectionManager = useSelectionManager(state);
    
    const handleRaceChange = useCallback(async (newRaceIndex: string) => {
        setField('race', newRaceIndex);
        dispatch({ type: 'RESET_RACE_SELECTIONS' });
        selectionManager.resetSelections('full');
    }, [setField, selectionManager]);

    const handleSubraceChange = useCallback(async (newSubraceIndex: string) => {
        setField('subrace', newSubraceIndex);
        // Resetting full selections on subrace change to re-evaluate traits/spells
        selectionManager.resetSelections('full');
    }, [setField, selectionManager]);

    const handleClassChange = useCallback(async (newClassIndex: string) => {
        setField('characterClass', newClassIndex);
        selectionManager.resetSelections('class');
    }, [setField, selectionManager]);

    const handleBackgroundChange = useCallback(async (newBackgroundIndex: string) => {
        setField('background', newBackgroundIndex);
        dispatch({ type: 'RESET_PERSONALITY' });
        selectionManager.resetSelections('background');
    }, [setField, dispatch, selectionManager]);

    const { ...derivedData } = useDerivedCharacterData(state, details, selectionManager.proficiencySelections, selectionManager.allProficiencyChoices);
    
    // Randomizers
    const handleRandomizeRaceAndClass = useCallback(async (races: ApiListItem[], classes: ApiListItem[]) => {
        const randomRaceItem = races[Math.floor(Math.random() * races.length)];
        const randomClass = classes[Math.floor(Math.random() * classes.length)];
        
        await handleRaceChange(randomRaceItem.index);
        await handleClassChange(randomClass.index);
        
        setTimeout(async () => {
            const raceData = await DndApiService.getRaceDetails(randomRaceItem.index);
            if (raceData && raceData.subraces && raceData.subraces.length > 0) {
                const randomSubrace = raceData.subraces[Math.floor(Math.random() * raceData.subraces.length)];
                await handleSubraceChange(randomSubrace.index);
            }
        }, 500);

    }, [handleRaceChange, handleClassChange, handleSubraceChange]);
    
    const { buildCharacter, isComplete } = useMemo(() => {
        const buildFn = (): NewCharacterInfo | null => {
            // Re-implement build logic based on the new state structure
            return null; // Placeholder
        };
        const completeCheck = false; // Placeholder
        return { buildCharacter: buildFn, isComplete: completeCheck };
    }, [state, details, selectionManager, derivedData]);
    
    return {
        ...state,
        setField,
        details,
        loadingStates,
        ...attributeManager,
        ...selectionManager,
        ...derivedData,
        handleRaceChange,
        handleSubraceChange,
        handleClassChange,
        handleBackgroundChange,
        handleRandomizeRaceAndClass,
        fetchFeats,
        isComplete,
        buildCharacter,
    };
};
