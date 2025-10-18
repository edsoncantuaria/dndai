// src/hooks/character-creation/useDerivedCharacterData.ts
import { useMemo } from 'react';
import type { ApiRace, ApiClass, ApiBackground, ApiSubrace, InventoryItem, Proficiency, ApiListItem, Feat, ApiEquipmentOption } from '@/types';
import type { CharacterCreatorState } from './reducer';
import * as characterUtils from '@/utils/characterUtils';
import { v4 as uuidv4 } from 'uuid';
import { getOptionLabel } from '@/utils/creationHelpers';

// Helper function to recursively find chosen items
const findChosenItems = (
    option: ApiEquipmentOption,
    selection: any,
    allEquipment: InventoryItem[]
): InventoryItem[] => {
    if (!option) return [];
    
    const results: InventoryItem[] = [];

    switch (option.option_type) {
        case 'counted_reference':
            const itemDetails = allEquipment.find(e => e.index === option.of?.index);
            if (itemDetails) {
                results.push({ ...itemDetails, quantity: option.count || 1, id: uuidv4() });
            }
            break;

        case 'choice':
            if (option.choice && Array.isArray(selection)) {
                selection.forEach(selectedIndex => {
                    if (selectedIndex !== -1) {
                         const categoryIndex = option.choice?.from?.equipment_category?.index;
                         if (categoryIndex) {
                            const subOptions = allEquipment.filter(item => {
                                if (!item) return false;
                                const itemCategory = item.equipment_category?.index;
                                const itemGearCategory = (item as any).gear_category?.index;
                                return itemCategory === categoryIndex ||
                                       itemGearCategory === categoryIndex ||
                                       (categoryIndex === 'martial-weapons' && item.weapon_category === 'Martial') ||
                                       (categoryIndex === 'simple-weapons' && item.weapon_category === 'Simple') ||
                                       (categoryIndex === 'martial-melee-weapons' && item.weapon_category === 'Martial' && item.weapon_range === 'Melee') ||
                                       (categoryIndex === 'simple-melee-weapons' && item.weapon_category === 'Simple' && item.weapon_range === 'Melee') ||
                                       (categoryIndex === 'arcane-foci' && itemGearCategory === 'arcane-foci') ||
                                       (categoryIndex === 'druidic-foci' && itemGearCategory === 'druidic-foci') ||
                                       (categoryIndex === 'holy-symbols' && itemGearCategory === 'holy-symbols');
                            });
                            const chosenItem = subOptions[selectedIndex];
                            if(chosenItem) {
                                results.push({ ...chosenItem, quantity: 1, id: uuidv4() });
                            }
                        }
                    }
                });
            }
            break;
            
        case 'multiple':
            if (Array.isArray(option.items)) {
                option.items.forEach((subOption, subIndex) => {
                    const subSelection = selection?.[subIndex];
                    results.push(...findChosenItems(subOption, subSelection, allEquipment));
                });
            }
            break;
    }

    return results;
};



export const useDerivedCharacterData = (
    state: CharacterCreatorState,
    details: {
        raceDetails: ApiRace | null;
        subraceDetails: ApiSubrace | null;
        classDetails: ApiClass | null;
        backgroundDetails: ApiBackground | null;
        availableFeats: Feat[];
    },
    allProficiencyChoices: any[],
    allEquipment: InventoryItem[],
    languageChoicesCount: number,
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
             const variantHumanSkillChoice = allProficiencyChoices.find(c => c.id === 'variant-human-skill');
             if(variantHumanSkillChoice && proficiencySelections['variant-human-skill']?.[0]) {
                 const skillIndex = proficiencySelections['variant-human-skill'][0];
                 const skill = variantHumanSkillChoice.options.find((o: any) => o.index === skillIndex);
                 if(skill) profs.set(skill.index, skill);
             }
        } else {
             (raceDetails?.starting_proficiency_options?.from?.options || []).forEach(opt => {
                const choiceId = `race-${raceDetails!.index}`;
                const selection = proficiencySelections[choiceId]?.[0];
                if(selection && opt.item?.index === selection) {
                    profs.set(selection, opt.item);
                }
             });
        }
        
         Object.values(proficiencySelections).flat().forEach(profIndex => {
            if (!profs.has(profIndex)) {
                for (const group of allProficiencyChoices) {
                    const option = group.options.find((opt: any) => opt.index === profIndex);
                    if (option) {
                        profs.set(profIndex, option);
                        break;
                    }
                }
            }
        });

        return Array.from(profs.values());

    }, [raceDetails, subraceDetails, classDetails, backgroundDetails, proficiencySelections, isVariantHuman, allProficiencyChoices]);
    
    
    const { equipmentChoiceGroups, fixedEquipment, finalizedEquipment, areAllEquipmentChoicesMade } = useMemo(() => {
        const choiceGroups: any[] = [];
        const fixed: InventoryItem[] = [];

        const processOption = (opt: ApiEquipmentOption) => {
            if (opt.option_type === 'counted_reference' && opt.of) {
                const itemDetails = allEquipment.find(e => e.index === opt.of!.index);
                if (itemDetails) {
                    fixed.push({ ...itemDetails, id: uuidv4(), quantity: opt.count || 1, equipped: false });
                }
            }
        };

        const addEquipment = (list: any[] = []) => list.forEach(item => processOption({ option_type: 'counted_reference', ...item.equipment, count: item.quantity }));
        
        if (classDetails) {
            addEquipment(classDetails.starting_equipment);
            classDetails.starting_equipment_options.forEach((choice, i) => choiceGroups.push({ id: `class-${i}`, source: 'Classe', choice }));
        }
        if (backgroundDetails) {
            addEquipment(backgroundDetails.starting_equipment);
            backgroundDetails.starting_equipment_options?.forEach((choice, i) => choiceGroups.push({ id: `bg-${i}`, source: 'Antecedente', choice }));
        }
    
        const finalEquip = choiceGroups.flatMap(group => {
            const selection = equipmentSelections?.[group.id];
            if (!selection || selection.main === undefined || selection.main === -1) return [];
            
            const mainOption = group.choice.from.options[selection.main];
            return findChosenItems(mainOption, selection.sub, allEquipment);
        });

        const allChoicesMade = choiceGroups.every(group => {
            const selection = equipmentSelections[group.id];
            if (selection?.main === undefined || selection.main === -1) return false;
        
            const mainOption = group.choice.from.options[selection.main];
            
            const countSubChoices = (option: ApiEquipmentOption): number => {
                if (option.option_type === 'choice') return option.choice.choose || 1;
                if (option.option_type === 'multiple') return (option.items || []).reduce((acc, item) => acc + countSubChoices(item), 0);
                return 0;
            };

            const flattenSubSelections = (subs: any): any[] => {
                if (subs === undefined || subs === null) return [];
                if (typeof subs !== 'object') return [];
                return Object.values(subs).flatMap(flattenSubSelections).concat(Object.values(subs).filter(v => typeof v === 'number'));
            }
            
            const requiredSubChoices = countSubChoices(mainOption);
            const madeSubChoices = flattenSubSelections(selection.sub).filter(val => val !== undefined && val !== -1).length;
            
            return madeSubChoices >= requiredSubChoices;
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
