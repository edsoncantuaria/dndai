// src/hooks/character-creation/useCharacterCreator.ts
import { useReducer, useMemo, useCallback } from 'react';
import { characterCreatorReducer, initialState, CharacterCreatorState } from './reducer';
import { useAttributeManager } from './useAttributeManager';
import { useDataManager } from './useDataManager';
import { useSelectionManager } from './useSelectionManager';
import { useDerivedCharacterData } from './useDerivedCharacterData';
import * as DndApiService from '@/services/dndApiService';
import type { NewCharacterInfo, ProficiencyChoice, ApiListItem } from '@/types';

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

    const { details, loadingStates, fetchFeats, allEquipment } = useDataManager(state.race, state.subrace, state.characterClass, state.background);
    const { raceDetails, classDetails, backgroundDetails } = details;

    const attributeManager = useAttributeManager(state, dispatch);

    const selectionManager = useSelectionManager(state, details, allLanguages, dispatch);
    
    const derivedData = useDerivedCharacterData(state, details, selectionManager.allProficiencyChoices, allEquipment, selectionManager.languageChoicesCount);

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

    const handleRandomizeBackground = useCallback(async (backgrounds: ApiListItem[]) => {
        const randomBgItem = backgrounds[Math.floor(Math.random() * backgrounds.length)];
        await handleBackgroundChange(randomBgItem.index);
        // O useEffect em useDataManager buscará os detalhes.
        // A lógica de preenchimento aleatório deve ser acionada quando os detalhes estiverem disponíveis.
        setTimeout(async () => {
            const details = await DndApiService.getBackgroundDetails(randomBgItem.index);
            if (!details) return;
            if (details.personality_traits) {
                const options = details.personality_traits.from.options;
                const shuffled = [...options].sort(() => 0.5 - Math.random());
                const selected = shuffled.slice(0, details.personality_traits.choose).map((opt: any) => opt.string);
                setField('personalityTraits', selected);
            }
            if (details.ideals) {
                const options = details.ideals.from.options;
                const randomIdeal = options[Math.floor(Math.random() * options.length)];
                setField('ideal', randomIdeal.string || randomIdeal.desc);
            }
            if (details.bonds) {
                const options = details.bonds.from.options;
                const randomBond = options[Math.floor(Math.random() * options.length)];
                setField('bond', randomBond.string);
            }
            if (details.flaws) {
                const options = details.flaws.from.options;
                const randomFlaw = options[Math.floor(Math.random() * options.length)];
                setField('flaw', randomFlaw.string);
            }
        }, 500); // Wait for details to load
    }, [handleBackgroundChange, setField]);
    
    const handleRandomizeRaceAndClass = useCallback(async (races: ApiListItem[], classes: ApiListItem[]) => {
        const randomRaceItem = races[Math.floor(Math.random() * races.length)];
        const randomClass = classes[Math.floor(Math.random() * classes.length)];
        
        await handleRaceChange(randomRaceItem.index);
        await handleClassChange(randomClass.index);
        
        // Use a timeout to allow state to update and data to be fetched
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
                .concat(Object.values(derivedData.finalizedEquipment).map((item: any) => item.index))
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
        ...attributeManager,
        ...selectionManager,
        ...derivedData,
        handleRaceChange,
        handleSubraceChange,
        handleClassChange,
        handleBackgroundChange,
        handleRandomizeBackground,
        handleRandomizeRaceAndClass,
        fetchFeats,
        isComplete,
        buildCharacter,
    };
};
