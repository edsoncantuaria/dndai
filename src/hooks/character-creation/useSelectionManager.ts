// src/hooks/character-creation/useSelectionManager.ts
import { useCallback, useMemo, useEffect } from 'react';
import type { ApiListItem, ApiSpell, Proficiency } from '@/types';
import { ProficiencyChoiceWithSource } from './useCharacterCreator';
import type { CharacterCreatorState, CharacterCreatorAction } from './reducer';
import type { Attributes } from '@/types';
import * as DndApiService from '@/services/dndApiService';
import { fetchDetailsInChunks } from '@/utils/apiUtils';

export const useSelectionManager = (
    state: CharacterCreatorState,
    details: any,
    allLanguages: ApiListItem[],
    dispatch: React.Dispatch<CharacterCreatorAction>
) => {
    const { 
        isVariantHuman, 
        characterClass, 
        proficiencySelections,
        equipmentSelections,
        chosenClassSpells,
        chosenRacialSpells,
        chosenLanguages,
        traitSelections,
    } = state;

    const { raceDetails, subraceDetails, classDetails, backgroundDetails, classSpellOptions, subclassSpells } = details;

    const setField = useCallback((field: keyof CharacterCreatorState, value: any) => {
        dispatch({ type: 'SET_FIELD', payload: { field, value } });
    }, [dispatch]);

    // --- PROFICIENCIES ---
    
    const allFixedProficiencies = useMemo<Map<string, Proficiency>>(() => {
        const profs = new Map<string, Proficiency>();
        const addProfs = (profList: Proficiency[] = []) => profList.forEach(p => p && profs.set(p.index, { ...p }));
        
        if (!isVariantHuman) addProfs(raceDetails?.starting_proficiencies);
        addProfs(subraceDetails?.starting_proficiencies);
        addProfs(classDetails?.proficiencies);
        addProfs(backgroundDetails?.starting_proficiencies);
        (classDetails?.saving_throws || []).forEach(st => st && profs.set(`saving-throw-${st.index}`, { index: st.index, name: `Saving Throw: ${st.name}`, url: st.url }));

        return profs;
    }, [raceDetails, subraceDetails, classDetails, backgroundDetails, isVariantHuman]);
    
    
    const allProficiencyChoices = useMemo(() => {
        if (!classDetails && !raceDetails && !backgroundDetails) return [];
        const choices: ProficiencyChoiceWithSource[] = [];
        const processChoice = (choice: any, source: ProficiencyChoiceWithSource['source'], idPrefix: string) => {
            if (!choice || !choice.from?.options) return;
            const options = choice.from.options.map((opt: any) => opt.item).filter(Boolean);
            if (options.length > 0) {
                 choices.push({
                    ...choice,
                    id: `${idPrefix}-group-${choices.length}`,
                    source: source,
                    options: options,
                });
            }
        };

        (classDetails?.proficiency_choices || []).forEach((c, i) => processChoice(c, 'Classe', `class-${i}`));
        if (!isVariantHuman) processChoice(raceDetails?.starting_proficiency_options, 'Raça', 'race');
        processChoice(subraceDetails?.starting_proficiency_options, 'Raça', 'subrace');
        processChoice(backgroundDetails?.starting_proficiency_options, 'Antecedente', 'bg');
        
        return choices;
    }, [raceDetails, subraceDetails, classDetails, backgroundDetails, isVariantHuman]);
    
    const unavailableProficiencies = useMemo(() => {
        const selectedInOtherGroups = new Set(Object.values(proficiencySelections).flat());
        allFixedProficiencies.forEach((_, key) => selectedInOtherGroups.add(key));
        return selectedInOtherGroups;
    }, [proficiencySelections, allFixedProficiencies]);

    const handleProficiencyChange = useCallback((profIndex: string, choiceGroup: ProficiencyChoiceWithSource) => {
        setField('proficiencySelections', (prev: Record<string, string[]>) => {
            const newSelections = { ...prev };
            const currentGroup = newSelections[choiceGroup.id] || [];
            const isSelected = currentGroup.includes(profIndex);

            if (isSelected) {
                newSelections[choiceGroup.id] = currentGroup.filter(p => p !== profIndex);
            } else if (currentGroup.length < choiceGroup.choose) {
                newSelections[choiceGroup.id] = [...currentGroup, profIndex];
            }
            return newSelections;
        });
    }, [setField]);

    const handleRandomizeProficiencies = useCallback(() => {
        const newSelections: Record<string, string[]> = {};
        const usedProficiencies = new Set(Array.from(allFixedProficiencies.keys()));
    
        allProficiencyChoices.forEach(choice => {
            const available = choice.options.filter((opt: any) => !usedProficiencies.has(opt.index));
            const shuffled = [...available].sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, choice.choose).map((opt: any) => opt.index);
            
            newSelections[choice.id] = selected;
            selected.forEach(s => usedProficiencies.add(s));
        });
        setField('proficiencySelections', newSelections);
    }, [allProficiencyChoices, allFixedProficiencies, setField]);
    
     // --- LANGUAGES ---

    const handleLanguageChange = useCallback((index: number, value: string) => {
        setField('chosenLanguages', (prev: string[]) => {
            const newLangs = [...prev];
            newLangs[index] = value;
            return newLangs;
        });
    }, [setField]);
    
     const handleRandomizeLanguages = useCallback((baseLanguages: string[], languageChoicesCount: number) => {
        if (languageChoicesCount <= 0) return;
        const availableLangs = allLanguages.filter(lang => !baseLanguages.includes(lang.name));
        const shuffled = [...availableLangs].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, languageChoicesCount).map(lang => lang.name);
        setField('chosenLanguages', selected);
    }, [allLanguages, setField]);

     // --- SPELLS ---

    const handleClassSpellChange = useCallback((spellIndex: string, cantripsKnown: number, spellsKnown: number, classSpells: ApiSpell[]) => {
        setField('chosenClassSpells', (prev: string[]) => {
            const spell = classSpells.find(s => s.index === spellIndex);
            if (!spell) return prev;
    
            const isCantrip = spell.level === 0;
            const limit = isCantrip ? cantripsKnown : spellsKnown;
            const currentSelected = prev.filter(sIdx => {
                const s = classSpells.find(opt => opt.index === sIdx);
                return s && s.level === spell.level;
            });
    
            if (prev.includes(spellIndex)) {
                return prev.filter(s => s !== spellIndex);
            }
            if (currentSelected.length < limit) {
                return [...prev, spellIndex];
            }
            return prev;
        });
    }, [setField]);

    const handleRacialSpellChange = useCallback((traitName: string, spellIndex: string, limit: number) => {
        setField('chosenRacialSpells', (prev: Record<string, string[]>) => {
            const newSelections = { ...prev };
            const currentSelected = newSelections[traitName] || [];
            
            if (currentSelected.includes(spellIndex)) {
                newSelections[traitName] = currentSelected.filter(s => s !== spellIndex);
            } else {
                 if (limit === 1) {
                    newSelections[traitName] = [spellIndex];
                } else if (currentSelected.length < limit) {
                    newSelections[traitName] = [...currentSelected, spellIndex];
                }
            }
            return newSelections;
        });
    }, [setField]);

    const { racialSpellTraits, racialSpellOptions } = useMemo(() => {
        const traitsWithOptions = (details.traitChoiceDetails || [])
            .filter(t => t.trait_specific?.spell_options);

        const traits = traitsWithOptions.map(t => ({
            traitName: t.name,
            choose: t.trait_specific!.spell_options!.choose,
            options: t.trait_specific!.spell_options!.from.options.map((o: any) => o.item)
        }));

        const allSpellRefs = traits.flatMap(t => t.options);
        return { racialSpellTraits: traits, racialSpellOptions: allSpellRefs };
    }, [details.traitChoiceDetails]);

    const cantripsKnown = useMemo(() => {
        if (!classDetails?.spellcasting) return 0;
        const cantripInfo = classDetails.spellcasting.info.find(i => i.name === 'Cantrips');
        return cantripInfo ? parseInt(cantripInfo.desc[0]?.match(/\d+/)?.[0] || '0', 10) : 0;
    }, [classDetails]);
    
    const spellsKnown = useMemo(() => {
        if (!classDetails?.spellcasting || !characterClass) return 0;
        const spellsKnownInfo = classDetails.spellcasting.info.find(i => i.name.startsWith('Spells Known'));
        if (spellsKnownInfo) {
            return parseInt(spellsKnownInfo.desc[0]?.match(/\d+/)?.[0] || '0', 10);
        }
        // Fallback for Cleric, Druid, Paladin
        const mainStatShort = classDetails.spellcasting.spellcasting_ability.index;
        const mainStat: keyof Attributes = (Object.keys(characterUtils.ATTRIBUTE_SHORT_MAP).find(key => characterUtils.ATTRIBUTE_SHORT_MAP[key as keyof typeof characterUtils.ATTRIBUTE_SHORT_MAP] === mainStatShort) || 'wisdom') as keyof Attributes;
        const modifier = characterUtils.calculateModifier(state.baseAttributes[mainStat] || 10);
        return Math.max(1, modifier + state.level);
    }, [classDetails, characterClass, state.baseAttributes, state.level]);

    const areClassSpellsSelected = useMemo(() => {
        const selectedCantripsCount = chosenClassSpells.filter(sIndex => (classSpellOptions.find(c => c.index === sIndex)?.level || 1) === 0).length;
        const selectedSpellsCount = chosenClassSpells.filter(sIndex => (classSpellOptions.find(c => c.index === sIndex)?.level || 0) === 1).length;
        return selectedCantripsCount === cantripsKnown && selectedSpellsCount === spellsKnown;
    }, [chosenClassSpells, classSpellOptions, cantripsKnown, spellsKnown]);

    const areRacialSpellsSelected = useMemo(() => 
        racialSpellTraits.every(trait => (chosenRacialSpells[trait.traitName]?.length || 0) === trait.choose),
    [racialSpellTraits, chosenRacialSpells]);

    const canProceedFromProficiencies = useMemo(() => {
        const allChoicesMade = allProficiencyChoices.every(choice => (proficiencySelections[choice.id]?.length || 0) === choice.choose);
        const allLangsChosen = state.chosenLanguages.filter(Boolean).length === derivedData.languageChoicesCount;
        return allChoicesMade && allLangsChosen;
    }, [allProficiencyChoices, proficiencySelections, state.chosenLanguages, derivedData.languageChoicesCount]);


    return {
        proficiencySelections,
        equipmentSelections,
        chosenClassSpells,
        chosenRacialSpells,
        chosenLanguages,
        traitSelections,
        allFixedProficiencies,
        allProficiencyChoices,
        unavailableProficiencies,
        handleProficiencyChange,
        handleLanguageChange,
        handleClassSpellChange,
        handleRacialSpellChange,
        handleRandomizeProficiencies,
        handleRandomizeLanguages,
        canProceedFromProficiencies,
        areClassSpellsSelected,
        areRacialSpellsSelected,
        cantripsKnown,
        spellsKnown,
        racialSpellOptions,
        racialSpellTraits,
        setField,
    };
};
