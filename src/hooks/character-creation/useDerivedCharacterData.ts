// src/hooks/character-creation/useDerivedCharacterData.ts
import { useMemo } from 'react';
import type { ApiRace, ApiClass, ApiBackground, ApiSubrace, InventoryItem, Proficiency, ApiListItem, Feat, ApiEquipmentOption } from '@/types';
import type { CharacterCreatorState } from './reducer';
import * as characterUtils from '@/utils/characterUtils';
import { v4 as uuidv4 } from 'uuid';
import { getOptionLabel } from '@/utils/creationHelpers';

const findChosenItems = (
    option: ApiEquipmentOption | undefined,
    selections: any, // Can be a single index number, or a complex object for nested choices
    allEquipment: InventoryItem[]
): InventoryItem[] => {
    if (!option || selections === undefined || selections === null || selections === -1) {
        return [];
    }

    const results: InventoryItem[] = [];

    switch (option.option_type) {
        case 'counted_reference':
            const itemDetails = allEquipment.find(e => e.index === option.of?.index);
            if (itemDetails) {
                results.push({ ...itemDetails, quantity: option.count || 1, id: uuidv4() });
            }
            break;

        case 'choice':
            // 'selections' here is the index of the item chosen from the category
            const chosenItemIndex = selections as string;
            const chosenItem = allEquipment.find(e => e.index === chosenItemIndex);
            if (chosenItem) {
                results.push({ ...chosenItem, quantity: 1, id: uuidv4() });
            }
            break;

        case 'multiple':
            // 'selections' here is an object with a 'sub' property for nested choices
            if (Array.isArray(option.items)) {
                option.items.forEach((subOption, subIndex) => {
                    if (subOption.option_type === 'counted_reference') {
                        // It's a fixed item within a multiple choice, add it directly.
                        const fixedItem = allEquipment.find(e => e.index === subOption.of?.index);
                        if (fixedItem) {
                            results.push({ ...fixedItem, quantity: subOption.count || 1, id: uuidv4() });
                        }
                    } else if (subOption.option_type === 'choice') {
                        // This is a nested choice, find the user's selection for it.
                        const subSelection = selections?.sub?.[subIndex];
                        if (subSelection) {
                            const subChosenItem = allEquipment.find(e => e.index === subSelection);
                            if (subChosenItem) {
                                results.push({ ...subChosenItem, quantity: 1, id: uuidv4() });
                            }
                        }
                    }
                });
            }
            break;
    }

    return results;
};


export const useDerivedCharacterData = (
    state: CharacterCreatorState,
    details: any, // Simplified details type
    selectionManager: any, // Simplified selectionManager type
    allEquipment: InventoryItem[]
) => {
    const { isVariantHuman, variantHumanBonusSelections, equipmentSelections, selectedFeat, proficiencySelections } = state;
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
    
    const finalProficiencies = useMemo(() => {
        const profs = new Map<string, Proficiency>();
        const addProfs = (profList: Proficiency[] = []) => profList.forEach(p => p && profs.set(p.index, { ...p }));

        addProfs(raceDetails?.starting_proficiencies);
        addProfs(subraceDetails?.starting_proficiencies);
        addProfs(classDetails?.proficiencies);
        addProfs(backgroundDetails?.starting_proficiencies);
        (classDetails?.saving_throws || []).forEach(st => st && profs.set(`saving-throw-${st.index}`, { index: st.index, name: `Saving Throw: ${st.name}`, url: st.url }));

        if(isVariantHuman) {
             const variantHumanSkillChoice = selectionManager.allProficiencyChoices.find((c:any) => c.id === 'variant-human-skill');
             if(variantHumanSkillChoice && proficiencySelections['variant-human-skill']?.[0]) {
                 const skillIndex = proficiencySelections['variant-human-skill'][0];
                 const skill = variantHumanSkillChoice.options.find((o: any) => o.index === skillIndex);
                 if(skill) profs.set(skill.index, skill);
             }
        }
        
         Object.values(proficiencySelections).flat().forEach(profIndex => {
            if (!profs.has(profIndex)) {
                for (const group of selectionManager.allProficiencyChoices) {
                    const option = group.options.find((opt: any) => opt.index === profIndex);
                    if (option) {
                        profs.set(profIndex, option);
                        break;
                    }
                }
            }
        });

        return Array.from(profs.values());

    }, [raceDetails, subraceDetails, classDetails, backgroundDetails, proficiencySelections, isVariantHuman, selectionManager.allProficiencyChoices]);
    
    
    const { equipmentChoiceGroups, fixedEquipment, finalizedEquipment, areAllEquipmentChoicesMade } = useMemo(() => {
        const choiceGroups: any[] = [];
        const fixed: InventoryItem[] = [];

        const processOption = (opt: ApiEquipmentOption) => {
            if (opt.option_type === 'counted_reference' && opt.of) {
                const itemDetails = allEquipment.find(e => e && e.index === opt.of!.index);
                if (itemDetails) {
                    fixed.push({ ...itemDetails, id: uuidv4(), quantity: opt.count || 1, equipped: false });
                }
            }
        };

        const addEquipment = (list: any[] = []) => list.forEach(item => {
            if (item.equipment) {
                processOption({ option_type: 'counted_reference', of: item.equipment, count: item.quantity });
            }
        });

        if (classDetails) {
            addEquipment(classDetails.starting_equipment);
            classDetails.starting_equipment_options.forEach((choice, i) => choiceGroups.push({ id: `class-${i}`, source: 'Classe', choice }));
        }
        if (backgroundDetails) {
            addEquipment(backgroundDetails.starting_equipment);
            backgroundDetails.starting_equipment_options?.forEach((choice, i) => choiceGroups.push({ id: `bg-${i}`, source: 'Antecedente', choice }));
        }

        const finalEquip: InventoryItem[] = [];
        choiceGroups.forEach(group => {
            const selection = equipmentSelections[group.id];
            const mainSelectionIndex = typeof selection === 'object' ? selection.main : selection;

            if (mainSelectionIndex === undefined || mainSelectionIndex < 0) return;

            const mainOption = group.choice.from.options[mainSelectionIndex];
            finalEquip.push(...findChosenItems(mainOption, selection, allEquipment));
        });

        const allChoicesMade = choiceGroups.every(group => {
            const selection = equipmentSelections[group.id];
            const mainSelectionIndex = typeof selection === 'object' ? selection.main : selection;
            if (mainSelectionIndex === undefined || mainSelectionIndex < 0) return false;
        
            const mainOption = group.choice.from.options[mainSelectionIndex];
            if (mainOption && mainOption.option_type === 'multiple' && Array.isArray(mainOption.items)) {
                return mainOption.items.every((subOption, subIndex) => {
                    if (subOption.option_type === 'choice') {
                        return selection.sub && selection.sub[subIndex];
                    }
                    return true;
                });
            }
            return true;
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
