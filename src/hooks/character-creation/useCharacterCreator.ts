// src/hooks/character-creation/useCharacterCreator.ts
import { useReducer, useMemo, useCallback } from 'react';
import { characterCreatorReducer, initialState, CharacterCreatorState } from './reducer';
import { useAttributeManager } from './useAttributeManager';
import { useDataManager } from './useDataManager';
import { useSelectionManager } from './useSelectionManager';
import { useDerivedCharacterData } from './useDerivedCharacterData';
import * as DndApiService from '../../services/dndApiService';
import type { NewCharacterInfo, ProficiencyChoice, ApiListItem, InventoryItem } from '../../types';

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

    const { 
        details, 
        loadingStates, 
        fetchFeats, 
        allEquipment,
        equipmentCategoryCache,
    } = useDataManager(state.race, state.subrace, state.characterClass, state.background);

    const { raceDetails, classDetails, backgroundDetails } = details;

    const attributeManager = useAttributeManager(state, dispatch);

    const selectionManager = useSelectionManager(state, details, allLanguages, dispatch);
    
    // CORREÇÃO: `selectionManager` deve ser criado antes e passado para `derivedData`.
    const derivedData = useDerivedCharacterData(state, details, selectionManager, allEquipment, equipmentCategoryCache);
    
    const handleEquipmentChoiceChange = useCallback((groupId: string, mainOptionIndex: number) => {
        setField('equipmentSelections', (prev: any) => {
            const newSelections = { ...prev };
            newSelections[groupId] = { 
                main: mainOptionIndex, 
                sub: {} // Reset sub-choices when main choice changes
            };
            return newSelections;
        });
    }, [setField]);
    
    const handleEquipmentSubChoiceChange = useCallback((groupId: string, itemIndex: string, subIndex: number) => {
        setField('equipmentSelections', (prev: any) => {
            const newSelections = { ...prev };
            const currentGroupSelection = prev[groupId] || {};
            
            const newSubSelections = { ...(currentGroupSelection.sub || {}) };
            newSubSelections[subIndex] = itemIndex;
    
            return {
                ...prev,
                [groupId]: {
                    ...currentGroupSelection,
                    sub: newSubSelections
                }
            };
        });
    }, [setField]);

    const handleRandomizeEquipment = useCallback(() => {
        const newSelections: Record<string, { main: number, sub: Record<number, string> }> = {};
    
        derivedData.equipmentChoiceGroups.forEach(group => {
            if (!group.choice?.from) return;
    
            let mainOptions: any[] = [];
            
            if (group.choice.from.option_set_type === 'options_array') {
                mainOptions = group.choice.from.options || [];
            } else if (group.choice.from.equipment_category) {
                const catKey = group.choice.from.equipment_category.index || group.choice.from.equipment_category.name;
                mainOptions = equipmentCategoryCache[catKey] || [];
                // Transform items into the expected option format for consistency
                mainOptions = mainOptions.map(item => ({ option_type: 'counted_reference', of: item }));
            }
    
            if (mainOptions.length > 0) {
                const randomMainIndex = Math.floor(Math.random() * mainOptions.length);
                const selectedMainOpt = mainOptions[randomMainIndex];
                const newSubSelections: Record<number, string> = {};

                // Handle sub-choices if the main choice requires it
                if (selectedMainOpt.option_type === 'choice' && selectedMainOpt.choice?.from) {
                     const subChoice = selectedMainOpt.choice;
                    const subCategoryKey = subChoice.from.equipment_category?.index;
                    let subOptions: any[] = [];

                    if (subCategoryKey && equipmentCategoryCache[subCategoryKey]) {
                        subOptions = equipmentCategoryCache[subCategoryKey];
                    } else if (subChoice.from.options) {
                        subOptions = subChoice.from.options.map((opt:any) => opt.item || opt.of);
                    }

                    if (subOptions.length > 0) {
                        for (let i = 0; i < (subChoice.choose || 1); i++) {
                            const randomSubIndex = Math.floor(Math.random() * subOptions.length);
                            newSubSelections[i] = subOptions[randomSubIndex]?.index;
                        }
                    }
                }
                
                newSelections[group.id] = { main: randomMainIndex, sub: newSubSelections };
            }
        });
    
        setField('equipmentSelections', newSelections);
    }, [derivedData.equipmentChoiceGroups, equipmentCategoryCache, setField]);

    const handleRaceChange = useCallback(async (newRaceIndex: string) => {
        setField('race', newRaceIndex);
        dispatch({ type: 'RESET_RACE_SELECTIONS' });
        dispatch({ type: 'RESET_SELECTIONS', payload: { type: 'full' } });
    }, [setField]);

    const handleSubraceChange = useCallback(async (newSubraceIndex: string) => {
        setField('subrace', newSubraceIndex);
    }, [setField]);

    const handleClassChange = useCallback(async (newClassIndex: string) => {
        setField('characterClass', newClassIndex);
        dispatch({ type: 'RESET_SELECTIONS', payload: { type: 'class' } });
    }, [setField]);

    const handleBackgroundChange = useCallback(async (newBackgroundIndex: string) => {
        setField('background', newBackgroundIndex);
        dispatch({ type: 'RESET_PERSONALITY' });
        dispatch({ type: 'RESET_SELECTIONS', payload: { type: 'background' } });
    }, [dispatch, setField]);
    
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
        const isPersonalityComplete = state.background ? (
            state.personalityTraits.length === (backgroundDetails?.personality_traits?.choose || 0) &&
            !!state.ideal && !!state.bond && !!state.flaw
        ) : false;

        const isComplete = (
            !!state.name && !!state.race && !!state.characterClass && !!state.background && !!state.alignment &&
            state.attributeMethod !== null && (state.attributeMethod === 'roll' || (state.attributeMethod === 'point-buy' && state.points === 0)) &&
            selectionManager.canProceedFromProficiencies &&
            derivedData.areAllEquipmentChoicesMade &&
            selectionManager.areClassSpellsSelected && 
            selectionManager.areRacialSpellsSelected
        );

        const buildFn = (): NewCharacterInfo | null => {
            if (!isComplete) return null;
            
            const homebrewIds = [state.race, state.subrace, state.characterClass, state.background, state.selectedFeat]
                .concat(Object.values(selectionManager.proficiencySelections).flat())
                .concat(derivedData.finalizedEquipment.map((item: InventoryItem) => item.id))
                .concat(selectionManager.chosenClassSpells)
                .concat(Object.values(selectionManager.chosenRacialSpells).flat())
                .filter(id => id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));


            return {
                name: state.name,
                sex: state.sex,
                hairStyle: state.hairStyle,
                beardStyle: state.beardStyle,
                skinColor: state.skinColor,
                race: details.raceDetails!.name,
                subrace: details.subraceDetails?.name || null,
                draconicAncestry: state.draconicAncestry,
                characterClass: details.classDetails!.name,
                subclassFlavor: details.classDetails?.subclasses?.[0]?.name || null,
                background: details.backgroundDetails!.name,
                alignment: state.alignment,
                attributes: derivedData.finalAttributes,
                proficiencies: derivedData.finalProficiencies,
                traits: Array.from(new Map([...(details.raceDetails?.traits || []), ...(details.subraceDetails?.racial_traits || [])].map(item => [item.index, item])).values()),
                languages: Array.from(new Set([...derivedData.baseLanguages, ...state.chosenLanguages.filter(Boolean)])),
                inventory: [...derivedData.fixedEquipment, ...derivedData.finalizedEquipment],
                spells: Array.from(new Set([...selectionManager.chosenClassSpells, ...Object.values(selectionManager.chosenRacialSpells).flat()])),
                backstory: state.backstory,
                personalityTraits: state.personalityTraits,
                ideal: state.ideal,
                bond: state.bond,
                flaw: state.flaw,
                feats: derivedData.finalFeats,
                hitDie: details.classDetails!.hit_die,
                subclass: null, // Subclass choice at level 1 is flavor
                homebrewIds: Array.from(new Set(homebrewIds)),
            };
        };

        return { buildCharacter: buildFn, isComplete };
    }, [state, details, selectionManager, derivedData, backgroundDetails]);
    
    return {
        ...state,
        setField,
        details,
        loadingStates,
        allEquipment,
        equipmentCategoryCache,
        handleEquipmentChoiceChange,
        handleEquipmentSubChoiceChange,
        handleRandomizeEquipment,
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
