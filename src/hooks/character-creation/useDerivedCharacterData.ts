// src/hooks/character-creation/useDerivedCharacterData.ts
import { useMemo } from 'react';
import type { ApiRace, ApiClass, ApiBackground, ApiSubrace, InventoryItem, Proficiency, ApiListItem, Feat } from '@/types';
import type { CharacterCreatorState } from './reducer';
import * as characterUtils from '@/utils/characterUtils';
import { v4 as uuidv4 } from 'uuid';
import { getOptionLabel } from '@/utils/creationHelpers';
import * as DndApiService from '../../services/dndApiService';
import { ProficiencyChoiceWithSource } from './useCharacterCreator';
import { useSelectionManager } from './useSelectionManager';

export const useDerivedCharacterData = (
    state: CharacterCreatorState,
    details: {
        raceDetails: ApiRace | null;
        subraceDetails: ApiSubrace | null;
        classDetails: ApiClass | null;
        backgroundDetails: ApiBackground | null;
        availableFeats: Feat[];
    },
    finalProficiencies: Proficiency[],
    allEquipment: InventoryItem[],
) => {
    const { isVariantHuman, variantHumanBonusSelections, equipmentSelections, selectedFeat } = state;
    const { raceDetails, subraceDetails, classDetails, backgroundDetails, availableFeats } = details;

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
        
        return bonuses;
    }, [raceDetails, subraceDetails, isVariantHuman, variantHumanBonusSelections]);

    const finalAttributes = useMemo(() =>
        (Object.keys(state.baseAttributes) as Array<keyof characterUtils.Attributes>).reduce((acc, key) => {
            acc[key] = state.baseAttributes[key] + (racialBonuses[key] || 0);
            return acc;
        }, {} as characterUtils.Attributes),
    [state.baseAttributes, racialBonuses]);
    
    
    const { equipmentChoiceGroups, fixedEquipment, finalizedEquipment, areAllEquipmentChoicesMade } = useMemo(() => {
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

        const finalEquip = choiceGroups.map(group => {
            const selection = (equipmentSelections || {})[group.id];
            if (!selection || selection.main === undefined) return null;
            const mainOption = group.choice.from.options[selection.main];

            if (mainOption.option_type === 'counted_reference') {
                return { ...mainOption.of, quantity: mainOption.count, id: uuidv4() };
            }
            if (mainOption.option_type === 'multiple') {
                return mainOption.items.map((item: any) => ({ ...item.of, quantity: item.count, id: uuidv4() }));
            }
            if (mainOption.option_type === 'choice') {
                if (selection.sub === undefined) return null;
                const categoryIndex = mainOption.choice.from.equipment_category.index;
                const subOptions = (allEquipment || []).filter(item => 
                    (item.equipment_category && item.equipment_category.index === categoryIndex) ||
                    (categoryIndex === 'martial-melee-weapons' && item.weapon_category === 'Martial' && item.weapon_range === 'Melee')
                );
                const subItem = subOptions[selection.sub];
                return { ...subItem, quantity: 1, id: uuidv4() };
            }
            return null;
        }).flat().filter(Boolean);

        const allChoicesMade = choiceGroups.every(group => {
            const selection = equipmentSelections[group.id];
            if (!selection || selection.main === undefined) return false;
            const mainOption = group.choice.from.options[selection.main];
            return mainOption.option_type !== 'choice' || selection.sub !== undefined;
        });

        return { 
            equipmentChoiceGroups: choiceGroups, 
            fixedEquipment: fixed, 
            finalizedEquipment: finalEquip,
            areAllEquipmentChoicesMade: allChoicesMade,
        };

    }, [classDetails, backgroundDetails, equipmentSelections, allEquipment]);

    const baseLanguages = useMemo(() => {
        const langs = new Set<string>();
        (raceDetails?.languages || []).forEach(l => langs.add(l.name));
        (subraceDetails?.languages || []).forEach(l => langs.add(l.name));
        return Array.from(langs);
    }, [raceDetails, subraceDetails]);

    const finalFeats = useMemo(() => {
        const feats: Feat[] = [];
        if (isVariantHuman && selectedFeat) {
            const featData = availableFeats.find(f => f.index === selectedFeat);
            if (featData) feats.push(featData);
        }
        return feats;
    }, [isVariantHuman, selectedFeat, availableFeats]);

    return {
        racialBonuses,
        finalAttributes,
        finalProficiencies,
        equipmentChoiceGroups,
        fixedEquipment,
        finalizedEquipment,
        areAllEquipmentChoicesMade,
        baseLanguages,
        finalFeats,
    };
};
