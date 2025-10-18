// src/hooks/character-creation/useSelectionManager.ts
import { useState, useCallback, useMemo } from 'react';
import type { ApiListItem, ApiSpell, Proficiency } from '@/types';
import { ProficiencyChoiceWithSource } from './useCharacterCreator';
import type { CharacterCreatorState } from './reducer';
import type { Attributes } from '@/types';

export const useSelectionManager = (
    state: CharacterCreatorState,
    allProficiencyChoices: ProficiencyChoiceWithSource[],
    allFixedProficiencies: Map<string, Proficiency>, // Recebe como argumento
    allLanguages: ApiListItem[],
    languageChoicesCount: number,
    classSpellOptions: ApiSpell[],
    subclassSpells: ApiSpell[]
) => {
    const { isVariantHuman, characterClass, baseLanguages } = state;
    
    const [proficiencySelections, setProficiencySelections] = useState<Record<string, string[]>>({});
    const [equipmentSelections, setEquipmentSelections] = useState<Record<string, { main?: number, sub?: number }>>({});
    const [chosenClassSpells, setChosenClassSpells] = useState<string[]>([]);
    const [chosenRacialSpells, setChosenRacialSpells] = useState<Record<string, string[]>>({});
    const [chosenLanguages, setChosenLanguages] = useState<string[]>([]);
    const [traitSelections, setTraitSelections] = useState<Record<string, string>>({});
    
    const [racialSpellOptions, setRacialSpellOptions] = useState<ApiSpell[]>([]);
    const [racialSpellTraits, setRacialSpellTraits] = useState<{ traitName: string; choose: number; options: ApiListItem[] }[]>([]);

    const unavailableProficiencies = useMemo(() => {
        const selectedInOtherGroups = new Set(Object.values(proficiencySelections).flat());
        return selectedInOtherGroups;
    }, [proficiencySelections]);


    const resetSelections = useCallback((type: 'full' | 'class' | 'background') => {
        setProficiencySelections({});
        setEquipmentSelections({});

        if (type === 'full') {
            setTraitSelections({});
            setChosenRacialSpells({});
            setChosenClassSpells([]);
            setChosenLanguages([]);
            setRacialSpellOptions([]);
            setRacialSpellTraits([]);
        } else if (type === 'class') {
            setChosenClassSpells([]);
        }
    }, []);

    const handleProficiencyChange = useCallback((profIndex: string, choiceGroup: ProficiencyChoiceWithSource) => {
        setProficiencySelections(prev => {
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
    }, []);
    
    const handleLanguageChange = useCallback((index: number, value: string) => {
        setChosenLanguages(prev => {
            const newLangs = [...prev];
            newLangs[index] = value;
            return newLangs;
        });
    }, []);

    const handleClassSpellChange = useCallback((spellIndex: string, cantripsKnown: number, spellsKnown: number, classSpellOptions: ApiSpell[]) => {
        setChosenClassSpells(prev => {
            const spell = classSpellOptions.find(s => s.index === spellIndex);
            if (!spell) return prev;
    
            const isCantrip = spell.level === 0;
            const limit = isCantrip ? cantripsKnown : spellsKnown;
            const currentSelected = prev.filter(sIdx => {
                const s = classSpellOptions.find(opt => opt.index === sIdx);
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
    }, []);

    const handleRacialSpellChange = useCallback((traitName: string, spellIndex: string, limit: number) => {
        setChosenRacialSpells(prev => {
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
    }, []);
    
    const handleVariantHumanBonusSelection = useCallback((dispatch: React.Dispatch<any>) => (attr: keyof Attributes) => {
        dispatch({
            type: 'SET_FIELD',
            payload: {
                field: 'variantHumanBonusSelections',
                value: (prev: (keyof Attributes)[]) => {
                    const isSelected = prev.includes(attr);
                    if (isSelected) {
                        return prev.filter(a => a !== attr);
                    }
                    if (prev.length < 2) {
                        return [...prev, attr];
                    }
                    return prev;
                },
            },
        });
    }, []);

    const handleRandomizeProficiencies = useCallback(() => {
        const newSelections: Record<string, string[]> = {};
        const usedProficiencies = new Set(allFixedProficiencies.keys());
    
        allProficiencyChoices.forEach(choice => {
            const available = choice.options.filter((opt: any) => !usedProficiencies.has(opt.index));
            const shuffled = [...available].sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, choice.choose).map((opt: any) => opt.index);
            
            newSelections[choice.id] = selected;
            selected.forEach(s => usedProficiencies.add(s));
        });
        setProficiencySelections(newSelections);
    }, [allProficiencyChoices, allFixedProficiencies]);

    const handleRandomizeLanguages = useCallback(() => {
        if (languageChoicesCount <= 0) return;
        const availableLangs = allLanguages.filter(lang => !baseLanguages.includes(lang.name));
        const shuffled = [...availableLangs].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, languageChoicesCount).map(lang => lang.name);
        setChosenLanguages(selected);
    }, [languageChoicesCount, allLanguages, baseLanguages]);

    const canProceedFromProficiencies = useMemo(() => {
        const proficienciesDone = allProficiencyChoices.every(choice => 
            (proficiencySelections[choice.id]?.length || 0) === choice.choose
        );
        const languagesDone = chosenLanguages.filter(Boolean).length === languageChoicesCount;
        return proficienciesDone && languagesDone;
    }, [allProficiencyChoices, proficiencySelections, chosenLanguages, languageChoicesCount]);


    return {
        proficiencySelections,
        equipmentSelections,
        chosenClassSpells,
        chosenRacialSpells,
        chosenLanguages,
        traitSelections,
        racialSpellOptions,
        racialSpellTraits,
        unavailableProficiencies,
        canProceedFromProficiencies,

        setChosenLanguages,
        setEquipmentSelections,
        setRacialSpellOptions,
        setRacialSpellTraits,
        setTraitSelections,
        resetSelections,

        handleProficiencyChange,
        handleLanguageChange,
        handleClassSpellChange,
        handleRacialSpellChange,
        handleVariantHumanBonusSelection,
        handleRandomizeProficiencies,
        handleRandomizeLanguages,
    };
};
