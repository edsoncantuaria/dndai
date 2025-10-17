// src/hooks/character-creation/useSelectionManager.ts
import { useState, useCallback } from 'react';
import type { ApiListItem, ApiSpell } from '@/types';
import { fetchDetailsInChunks } from '@/utils/apiUtils';
import { translateSpell } from '@/utils/translator';
import * as DndApiService from '@/services/dndApiService';
import { ProficiencyChoiceWithSource } from '../useCharacterCreator';
import type { CharacterCreatorState } from './reducer';

export const useSelectionManager = (state: CharacterCreatorState) => {
    const { isVariantHuman } = state;
    
    // Selections
    const [proficiencySelections, setProficiencySelections] = useState<Record<string, string[]>>({});
    const [equipmentSelections, setEquipmentSelections] = useState<Record<string, { main?: number, sub?: number }>>({});
    const [chosenClassSpells, setChosenClassSpells] = useState<string[]>([]);
    const [chosenRacialSpells, setChosenRacialSpells] = useState<Record<string, string[]>>({});
    const [chosenLanguages, setChosenLanguages] = useState<string[]>([]);
    const [traitSelections, setTraitSelections] = useState<Record<string, string>>({});
    
    const [racialSpellOptions, setRacialSpellOptions] = useState<ApiSpell[]>([]);
    const [racialSpellTraits, setRacialSpellTraits] = useState<{ traitName: string; choose: number; options: ApiListItem[] }[]>([]);

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


    return {
        proficiencySelections,
        equipmentSelections,
        chosenClassSpells,
        chosenRacialSpells,
        chosenLanguages,
        traitSelections,
        racialSpellOptions,
        racialSpellTraits,

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
    };
};
