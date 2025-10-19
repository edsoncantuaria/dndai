// src/hooks/character-creation/useSelectionManager.ts
import { useCallback, useMemo, useState, useEffect } from 'react';
import type { ApiListItem, ApiSpell, Proficiency } from '@/types';
import { ProficiencyChoiceWithSource } from './useCharacterCreator';
import type { CharacterCreatorState, CharacterCreatorAction } from './reducer';
import type { Attributes } from '@/types';
import * as DndApiService from '@/services/dndApiService';
import { fetchDetailsInChunks } from '@/utils/apiUtils';
import * as characterUtils from '@/utils/characterUtils';


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
    const [racialSpellOptions, setRacialSpellOptions] = useState<ApiSpell[]>([]);

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
    
    const allProficiencyChoices = useMemo<ProficiencyChoiceWithSource[]>(() => {
        if (!classDetails && !raceDetails && !backgroundDetails) return [];
        const choices: ProficiencyChoiceWithSource[] = [];
        const processChoice = (choice: any, source: ProficiencyChoiceWithSource['source'], idPrefix: string) => {
            if (!choice || !choice.from?.options) return;
            const options = choice.from.options.map((opt: any) => opt.item).filter((item: ApiListItem | undefined) => item && !allFixedProficiencies.has(item.index));
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
    }, [raceDetails, subraceDetails, classDetails, backgroundDetails, isVariantHuman, allFixedProficiencies]);
    
    
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
    
    const cantripsKnown = useMemo(() => {
        if (!classDetails?.spellcasting) return 0;
        const level1Data = details.classLevels?.find((l: any) => l.level === 1);
        if (level1Data?.spellcasting?.cantrips_known) {
            return level1Data.spellcasting.cantrips_known;
        }
        const cantripInfo = classDetails.spellcasting.info.find(i => i.name === 'Cantrips Known' || i.name === 'Cantrips');
        return cantripInfo ? parseInt(cantripInfo.desc[0]?.match(/\d+/)?.[0] || '0', 10) : 0;
    }, [classDetails, details.classLevels]);
    
    const spellsKnown = useMemo(() => {
        if (!classDetails?.spellcasting || !characterClass) return 0;
    
        // Classes that PREPARE spells (Cleric, Druid, Paladin) don't "know" a fixed number at level 1.
        if (['cleric', 'druid', 'paladin'].includes(characterClass.toLowerCase())) {
            return 0;
        }
    
        const level1Data = details.classLevels?.find((l: any) => l.level === 1);
        if (level1Data?.spellcasting?.spells_known) {
            return level1Data.spellcasting.spells_known;
        }
    
        const spellsKnownInfo = classDetails.spellcasting.info.find((i: any) => i.name.startsWith('Spells Known'));
        if (spellsKnownInfo) {
            return parseInt(spellsKnownInfo.desc[0]?.match(/\d+/)?.[0] || '0', 10);
        }
        
        // Fallback for classes like Wizard at level 1.
        if (classDetails.index === 'wizard' && state.level === 1) {
            return 6;
        }
    
        // Default calculation for others like Bard if specific data is missing
        const mainStatShort = classDetails.spellcasting.spellcasting_ability.index;
        const mainStat: keyof Attributes = (Object.keys(characterUtils.ATTRIBUTE_SHORT_MAP).find(key => characterUtils.ATTRIBUTE_SHORT_MAP[key as keyof typeof characterUtils.ATTRIBUTE_SHORT_MAP] === mainStatShort) || 'wisdom') as keyof Attributes;
        const modifier = characterUtils.calculateModifier(state.baseAttributes[mainStat] || 10);
        return Math.max(1, modifier + state.level);
    }, [classDetails, characterClass, state.baseAttributes, state.level, details.classLevels]);

    const handleClassSpellChange = useCallback((spellIndex: string) => {
        setField('chosenClassSpells', (prev: string[]) => {
            const classSpells = [...classSpellOptions, ...subclassSpells];
            const spell = classSpells.find(s => s.index === spellIndex);
            if (!spell) return prev;
    
            const isCantrip = spell.level === 0;
            const limit = isCantrip ? cantripsKnown : spellsKnown;
            
            const currentSelectedOfSameLevel = prev.filter(sIdx => {
                const s = classSpells.find(opt => opt.index === sIdx);
                return s && s.level === spell.level;
            });
    
            if (prev.includes(spellIndex)) {
                return prev.filter(s => s !== spellIndex);
            }
            if (currentSelectedOfSameLevel.length < limit) {
                return [...prev, spellIndex];
            }
            return prev;
        });
    }, [setField, classSpellOptions, subclassSpells, cantripsKnown, spellsKnown]);


    const handleRandomizeSpells = useCallback(() => {
        // Randomize Class Spells
        const allClassSpells = [...classSpellOptions, ...subclassSpells];
        const cantrips = allClassSpells.filter(s => s.level === 0);
        const level1Spells = allClassSpells.filter(s => s.level === 1);

        const shuffledCantrips = [...cantrips].sort(() => 0.5 - Math.random());
        const shuffledLevel1s = [...level1Spells].sort(() => 0.5 - Math.random());

        const selectedCantrips = shuffledCantrips.slice(0, cantripsKnown).map(s => s.index);
        const selectedLevel1s = shuffledLevel1s.slice(0, spellsKnown).map(s => s.index);
        
        setField('chosenClassSpells', [...selectedCantrips, ...selectedLevel1s]);

        // Randomize Racial Spells
        const newRacialSelections: Record<string, string[]> = {};
        racialSpellTraits.forEach((trait: any) => {
            const availableOptions = racialSpellOptions.filter(spell => 
                trait.options.some((opt: any) => opt.index === spell.index)
            );
            const shuffled = [...availableOptions].sort(() => 0.5 - Math.random());
            newRacialSelections[trait.traitName] = shuffled.slice(0, trait.choose).map(s => s.index);
        });

        setField('chosenRacialSpells', newRacialSelections);

    }, [classSpellOptions, subclassSpells, cantripsKnown, spellsKnown, racialSpellTraits, racialSpellOptions, setField]);
    

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
    
    const racialSpellTraits = useMemo(() => {
        const traitsWithOptions = (details.traitChoiceDetails || [])
            .filter((t:any) => t?.trait_specific?.spell_options);

        return traitsWithOptions.map((t:any) => ({
            traitName: t.name,
            choose: t.trait_specific!.spell_options!.choose,
            options: t.trait_specific!.spell_options!.from.options.map((o: any) => o.item)
        }));
    }, [details.traitChoiceDetails]);

    useEffect(() => {
        const fetchRacialSpellDetails = async () => {
            const allSpellRefs = racialSpellTraits.flatMap((t:any) => t.options);
            if(allSpellRefs.length > 0) {
                const spellDetails = await fetchDetailsInChunks(allSpellRefs, DndApiService.getSpellDetails, () => {});
                setRacialSpellOptions(spellDetails.filter(Boolean) as ApiSpell[]);
            } else {
                setRacialSpellOptions([]);
            }
        };
        fetchRacialSpellDetails();
    }, [racialSpellTraits]);


    const areClassSpellsSelected = useMemo(() => {
        const allClassSpells = [...classSpellOptions, ...subclassSpells];
        const selectedCantripsCount = chosenClassSpells.filter(sIndex => (allClassSpells.find(c => c.index === sIndex)?.level) === 0).length;
        const selectedSpellsCount = chosenClassSpells.filter(sIndex => (allClassSpells.find(c => c.index === sIndex)?.level) === 1).length;
        return selectedCantripsCount === cantripsKnown && selectedSpellsCount === spellsKnown;
    }, [chosenClassSpells, classSpellOptions, subclassSpells, cantripsKnown, spellsKnown]);

    const areRacialSpellsSelected = useMemo(() => 
        racialSpellTraits.every((trait:any) => (chosenRacialSpells[trait.traitName]?.length || 0) === trait.choose),
    [racialSpellTraits, chosenRacialSpells]);

    const languageChoicesCount = useMemo(() => {
        let count = 0;
        if (raceDetails?.language_options) count += raceDetails.language_options.choose;
        if (backgroundDetails?.language_options) count += backgroundDetails.language_options.choose;
        if (details.subraceDetails?.language_options) count += details.subraceDetails.language_options.choose;
        return count;
    }, [raceDetails, backgroundDetails, details.subraceDetails]);

    const canProceedFromProficiencies = useMemo(() => {
        const allChoicesMade = allProficiencyChoices.every(choice => (proficiencySelections[choice.id]?.length || 0) === choice.choose);
        const allLangsChosen = state.chosenLanguages.filter(Boolean).length === languageChoicesCount;
        return allChoicesMade && allLangsChosen;
    }, [allProficiencyChoices, proficiencySelections, state.chosenLanguages, languageChoicesCount]);


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
        handleRandomizeSpells,
        canProceedFromProficiencies,
        areClassSpellsSelected,
        areRacialSpellsSelected,
        cantripsKnown,
        spellsKnown,
        racialSpellOptions,
        racialSpellTraits,
        languageChoicesCount,
        setField,
    };
};
