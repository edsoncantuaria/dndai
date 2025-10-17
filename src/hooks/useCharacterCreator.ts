// src/hooks/useCharacterCreator.ts
import { useReducer, useMemo, useCallback } from 'react';
import { characterCreatorReducer, initialState } from './character-creation/reducer';
import { useAttributeManager } from './character-creation/useAttributeManager';
import { useDataManager } from './character-creation/useDataManager';
import { useSelectionManager } from './character-creation/useSelectionManager';
import { useDerivedCharacterData } from './character-creation/useDerivedCharacterData';
import { v4 as uuidv4 } from 'uuid';
import * as characterUtils from '@/utils/characterUtils';
import type { NewCharacterInfo, Proficiency, InventoryItem, ApiListItem, Feat } from '@/types';

export const useCharacterCreator = ({ allLanguages }: { allLanguages: ApiListItem[] }) => {
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
        selectionManager.resetSelections('full'); // Subrace change might affect spells/traits
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

    const { finalProficiencies, ...derivedData } = useDerivedCharacterData(state, details, selectionManager.proficiencySelections, []);

    const buildCharacter = (): NewCharacterInfo | null => {
        if (!raceDetails || !classDetails || !backgroundDetails) return null;

        const finalInventory: InventoryItem[] = []; // This needs to be built from selections
        
        const allSpells = [...new Set([...selectionManager.chosenClassSpells, ...Object.values(selectionManager.chosenRacialSpells).flat()])];

        const finalTraitsMap = new Map<string, ApiListItem>();
        (raceDetails.traits || []).forEach(trait => finalTraitsMap.set(trait.index, trait));
        (details.subraceDetails?.racial_traits || []).forEach(trait => finalTraitsMap.set(trait.index, trait));

        return {
            name: state.name,
            sex: state.sex,
            hairStyle: state.hairStyle,
            beardStyle: state.beardStyle,
            skinColor: state.skinColor,
            race: raceDetails.name,
            subrace: details.subraceDetails?.name || null,
            draconicAncestry: state.draconicAncestry || undefined,
            characterClass: classDetails.name,
            subclassFlavor: details.classDetails?.subclasses?.[0]?.name || null,
            background: backgroundDetails.name,
            alignment: state.alignment,
            attributes: derivedData.finalAttributes,
            proficiencies: finalProficiencies,
            traits: Array.from(finalTraitsMap.values()),
            languages: selectionManager.chosenLanguages,
            inventory: finalInventory,
            spells: allSpells,
            backstory: state.backstory,
            personalityTraits: state.personalityTraits,
            ideal: state.ideal,
            bond: state.bond,
            flaw: state.flaw,
            feats: [], // Simplified for now
            hitDie: classDetails.hit_die,
            subclass: null,
            level: 1,
        };
    };

    return {
        // State and Setters
        ...state,
        setField,
        details,
        loadingStates,
        
        // Selections
        ...selectionManager,

        // Derived Data
        ...derivedData,
        finalProficiencies,

        // Handlers
        ...attributeManager,
        handleRaceChange,
        handleSubraceChange,
        handleClassChange,
        handleBackgroundChange,
        fetchFeats,

        // Finalization
        isComplete: false, // This needs to be re-implemented based on new state structure
        buildCharacter,
    };
};
