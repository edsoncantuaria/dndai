// src/hooks/useCharacterCreator.ts
import { useReducer, useMemo, useCallback } from 'react';
import { characterCreatorReducer, initialState, CharacterCreatorState } from './character-creation/reducer';
import { useAttributeManager } from './character-creation/useAttributeManager';
import { useDataManager } from './character-creation/useDataManager';
import { useSelectionManager } from './character-creation/useSelectionManager';
import { useDerivedCharacterData } from './character-creation/useDerivedCharacterData';
import * as DndApiService from '../services/dndApiService';
import type { NewCharacterInfo, Proficiency, InventoryItem, ApiListItem, Feat, ApiTrait, ApiSpell, ProficiencyChoice } from '../types';

export interface ProficiencyChoiceWithSource extends ProficiencyChoice {
    id: string;
    source: 'Raça' | 'Classe' | 'Antecedente';
    options: ApiListItem[];
};

export type EquipmentChoiceGroup = {
    id: string;
    source: 'Classe' | 'Antecedente';
    choice: ProficiencyChoice;
}

export const useCharacterCreator = ({ allLanguages }: { allLanguages: ApiListItem[] }) => {
    const [state, dispatch] = useReducer(characterCreatorReducer, initialState);

    const setField = useCallback((field: keyof CharacterCreatorState, value: any) => {
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
        selectionManager.resetSelections('full'); // Re-evaluate traits
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
    
    // Pass selectionManager.allProficiencyChoices to derived data hook
    const { ...derivedData } = useDerivedCharacterData(state, details, selectionManager.proficiencySelections, selectionManager.allProficiencyChoices);

    const handleRandomizeRaceAndClass = useCallback(async (races: ApiListItem[], classes: ApiListItem[]) => {
        const randomRaceItem = races[Math.floor(Math.random() * races.length)];
        const randomClass = classes[Math.floor(Math.random() * classes.length)];
        await handleRaceChange(randomRaceItem.index);
        await handleClassChange(randomClass.index);
        
        setTimeout(async () => {
            const raceData = await DndApiService.getRaceDetails(randomRaceItem.index);
            if (raceData?.subraces?.length) {
                const randomSubrace = raceData.subraces[Math.floor(Math.random() * raceData.subraces.length)];
                await handleSubraceChange(randomSubrace.index);
            }
        }, 500);
    }, [handleRaceChange, handleClassChange, handleSubraceChange]);
    
    const { buildCharacter, isComplete } = useMemo(() => {
        // Build character logic and completion check
        const isComplete = false; // Placeholder
        const buildCharacter = (): NewCharacterInfo | null => null; // Placeholder
        return { buildCharacter, isComplete };
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
        allLanguages
    };
};
