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
    
    const allProficiencyChoices = useMemo(() => {
        // This logic is now centralized here, as it's derived data.
        const choices: ProficiencyChoiceWithSource[] = [];
        const processChoice = (choice: ProficiencyChoice | undefined, source: ProficiencyChoiceWithSource['source'], idPrefix: string) => {
            if (!choice || !choice.from?.options) return;
            choice.from.options.forEach((option, index) => {
                const newId = `${idPrefix}-${index}`;
                if (option.option_type === 'choice') {
                    processChoice(option.choice, source, newId);
                } else if (option.option_type === 'reference' && option.item) {
                    const descSlice = choice.desc ? choice.desc.substring(0, 10) : choice.type || 'default';
                    const parentId = `${idPrefix}-group-${descSlice}`;
                    const existingGroup = choices.find(c => c.id === parentId);
                    if (existingGroup) {
                        existingGroup.options.push(option.item);
                    } else {
                        choices.push({ ...choice, id: parentId, source, options: [option.item] });
                    }
                }
            });
        };
        (classDetails?.proficiency_choices || []).forEach((c, i) => processChoice(c, 'Classe', `class-${i}`));
        if (!state.isVariantHuman) { processChoice(raceDetails?.starting_proficiency_options, 'Raça', 'race'); }
        processChoice(details.subraceDetails?.starting_proficiency_options, 'Raça', 'subrace');
        processChoice(backgroundDetails?.starting_proficiency_options, 'Antecedente', 'bg');
        if (state.isVariantHuman) {
             choices.push({
                id: 'variant-human-skill', source: 'Raça', desc: 'Escolha uma perícia (Humano Variante)',
                choose: 1, type: 'proficiencies', options: DndApiService.getSkills().then(res => res?.results || []) as any // Simplified
            });
        }
        return choices;
    }, [raceDetails, details.subraceDetails, classDetails, backgroundDetails, state.isVariantHuman]);
    
    const { allFixedProficiencies, ...derivedData } = useDerivedCharacterData(state, details, allProficiencyChoices);
    const selectionManager = useSelectionManager(state, allProficiencyChoices, allFixedProficiencies, allLanguages, details.classSpellOptions, details.subclassSpells);

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

    const handleRandomizeBackground = useCallback(async (backgrounds: ApiListItem[]) => {
        const randomBgItem = backgrounds[Math.floor(Math.random() * backgrounds.length)];
        await handleBackgroundChange(randomBgItem.index);
        // We need to fetch details to randomize personality
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
        }, 500); // Timeout to allow state to update and details to fetch
    }, [handleBackgroundChange]);
    
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
        // The logic for isComplete and buildCharacter would be complex and depends on all hooks.
        // This is a simplified representation.
        const canProceedFromProficiencies = derivedData.canProceedFromProficiencies;
        
        const isPersonalityComplete = state.background ? (
            state.personalityTraits.length === (backgroundDetails?.personality_traits?.choose || 0) &&
            !!state.ideal && !!state.bond && !!state.flaw
        ) : false;

        const isComplete = (
            !!state.name && !!state.race && !!state.characterClass && !!state.background && !!state.alignment &&
            state.attributeMethod !== null && (state.attributeMethod === 'roll' || (state.attributeMethod === 'point-buy' && state.points === 0)) &&
            canProceedFromProficiencies &&
            derivedData.areAllEquipmentChoicesMade &&
            selectionManager.areClassSpellsSelected && 
            selectionManager.areRacialSpellsSelected
        );

        const buildFn = (): NewCharacterInfo | null => {
            if (!isComplete) return null;
            return {
                name: state.name,
                sex: state.sex,
                hairStyle: state.hairStyle,
                beardStyle: state.beardStyle,
                skinColor: state.skinColor,
                race: raceDetails!.name,
                subrace: details.subraceDetails?.name || null,
                characterClass: classDetails!.name,
                subclassFlavor: details.subclassFlavor || null,
                background: backgroundDetails!.name,
                alignment: state.alignment,
                attributes: derivedData.finalAttributes,
                proficiencies: derivedData.finalProficiencies,
                traits: Array.from(new Map([...(raceDetails?.traits || []), ...(details.subraceDetails?.racial_traits || [])].map(item => [item.index, item])).values()),
                languages: Array.from(new Set([...selectionManager.baseLanguages, ...selectionManager.chosenLanguages.filter(Boolean)])),
                inventory: [...derivedData.fixedEquipment, ...selectionManager.finalizedEquipment],
                spells: Array.from(new Set([...selectionManager.chosenClassSpells, ...Object.values(selectionManager.chosenRacialSpells).flat()])),
                backstory: state.backstory,
                personalityTraits: state.personalityTraits,
                ideal: state.ideal,
                bond: state.bond,
                flaw: state.flaw,
                feats: [], // Feats logic needs to be fully integrated
                hitDie: classDetails!.hit_die,
                subclass: null,
            };
        };

        return { buildCharacter: buildFn, isComplete };
    }, [state, details, selectionManager, derivedData]);
    
    return {
        ...state,
        setField,
        details,
        loadingStates,
        allLanguages,
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
