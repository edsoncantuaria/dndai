// src/hooks/character-creation/useDerivedCharacterData.ts
import { useMemo } from 'react';
import type { ApiRace, ApiClass, ApiBackground, ApiSubrace, InventoryItem, Proficiency } from '@/types';
import type { CharacterCreatorState } from './reducer';
import * as characterUtils from '@/utils/characterUtils';
import { v4 as uuidv4 } from 'uuid';
import { ProficiencyChoiceWithSource } from '../useCharacterCreator';

export const useDerivedCharacterData = (
    state: CharacterCreatorState,
    details: {
        raceDetails: ApiRace | null;
        subraceDetails: ApiSubrace | null;
        classDetails: ApiClass | null;
        backgroundDetails: ApiBackground | null;
    },
    proficiencySelections: Record<string, string[]>,
    allProficiencyChoices: ProficiencyChoiceWithSource[],
    allFixedProficiencies: Map<string, Proficiency>
) => {
    const { isVariantHuman, variantHumanBonusSelections, traitSelections } = state;
    const { raceDetails, subraceDetails, classDetails, backgroundDetails } = details;

    const racialBonuses = useMemo(() => {
        const bonuses: Partial<characterUtils.Attributes> = {};
        if (isVariantHuman) {
            variantHumanBonusSelections.forEach(attr => {
                bonuses[attr] = (bonuses[attr] || 0) + 1;
            });
            return bonuses;
        }

        const addBonuses = (bonusList: { ability_score: { index: string }, bonus: number }[]) => {
            (bonusList || []).forEach(b => {
                if (b?.ability_score?.index) {
                    const attrKey = characterUtils.ATTRIBUTE_SHORT_MAP[b.ability_score.index];
                    if (attrKey) bonuses[attrKey] = (bonuses[attrKey] || 0) + b.bonus;
                }
            });
        };
        
        addBonuses(raceDetails?.ability_bonuses || []);
        addBonuses(subraceDetails?.ability_bonuses || []);
        
        const abilityBonusChoices = raceDetails?.ability_bonus_options;
        if (abilityBonusChoices?.from?.options?.[0]?.item?.index) {
            const selectionKey = abilityBonusChoices.from.options[0].item.index;
            const selection = traitSelections[selectionKey];
            if (selection) {
                const selectedBonus = abilityBonusChoices.from.options.find(o => o.item.index === selection);
                if (selectedBonus?.item) {
                    const attrKey = characterUtils.ATTRIBUTE_SHORT_MAP[selectedBonus.item.index.replace('ability-bonus-', '')];
                    if (attrKey) bonuses[attrKey] = (bonuses[attrKey] || 0) + 1;
                }
            }
        }
        
        return bonuses;
    }, [raceDetails, subraceDetails, traitSelections, isVariantHuman, variantHumanBonusSelections]);

    const finalAttributes = useMemo(() =>
        (Object.keys(state.baseAttributes) as Array<keyof characterUtils.Attributes>).reduce((acc, key) => {
            acc[key] = state.baseAttributes[key] + (racialBonuses[key] || 0);
            return acc;
        }, {} as characterUtils.Attributes),
    [state.baseAttributes, racialBonuses]);
    
    const { equipmentChoiceGroups, fixedEquipment } = useMemo(() => {
        const choiceGroups: any[] = [];
        let fixed: InventoryItem[] = [];
    
        const addEquipment = (list: { equipment: any, quantity: number }[] = []) => {
            list.forEach(item => fixed.push({ ...item.equipment, id: uuidv4(), quantity: item.quantity, equipped: false }));
        };
    
        if (classDetails) {
            addEquipment(classDetails.starting_equipment);
            classDetails.starting_equipment_options.forEach((choice, i) => choiceGroups.push({ id: `class-${i}`, source: 'Classe', choice }));
        }
        if (backgroundDetails) {
            addEquipment(backgroundDetails.starting_equipment);
            backgroundDetails.starting_equipment_options?.forEach((choice, i) => choiceGroups.push({ id: `bg-${i}`, source: 'Antecedente', choice }));
        }
        
        return { equipmentChoiceGroups: choiceGroups, fixedEquipment: fixed };
    }, [classDetails, backgroundDetails]);

    const finalProficiencies = useMemo(() => {
        const profs: Proficiency[] = Array.from(allFixedProficiencies.values());
        Object.values(proficiencySelections).flat().forEach(profIndex => {
            for (const choiceGroup of allProficiencyChoices) {
                const option = choiceGroup.options.find((opt: any) => opt.index === profIndex);
                if (option) {
                    profs.push({ index: option.index, name: option.name, url: option.url });
                    return;
                }
            }
        });
        return profs;
    }, [allFixedProficiencies, proficiencySelections, allProficiencyChoices]);

    return {
        racialBonuses,
        finalAttributes,
        equipmentChoiceGroups,
        fixedEquipment,
        finalProficiencies
    };
};
