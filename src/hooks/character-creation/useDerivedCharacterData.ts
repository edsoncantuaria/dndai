// src/hooks/character-creation/useDerivedCharacterData.ts
import { useMemo } from 'react';
import type { ApiRace, ApiClass, ApiBackground, ApiSubrace, InventoryItem, Proficiency, ApiListItem, Feat, ApiEquipmentOption } from '@/types';
import type { CharacterCreatorState } from './reducer';
import * as characterUtils from '@/utils/characterUtils';
import { v4 as uuidv4 } from 'uuid';

export const useDerivedCharacterData = (
    state: CharacterCreatorState,
    details: any,
    selectionManager: any,
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
            if (selection === undefined || selection.main === undefined || selection.main < 0) return;
            
            const mainOption = group.choice.from.options[selection.main];
            if (!mainOption) return;

            if (mainOption.option_type === 'counted_reference' && mainOption.of) {
                const item = allEquipment.find(e => e.index === mainOption.of!.index);
                if (item) finalEquip.push({ ...item, quantity: mainOption.count || 1, id: uuidv4() });
            } else if (mainOption.option_type === 'multiple' && mainOption.items) {
                 mainOption.items.forEach((subOpt: ApiEquipmentOption, subIndex: number) => {
                    if (subOpt.option_type === 'counted_reference' && subOpt.of) {
                        const item = allEquipment.find(e => e.index === subOpt.of!.index);
                        if (item) finalEquip.push({ ...item, quantity: subOpt.count || 1, id: uuidv4() });
                    } else if (subOpt.option_type === 'choice') {
                        const subSelection = selection.sub?.[subIndex];
                        if (subSelection) {
                            const item = allEquipment.find(e => e.index === subSelection);
                            if (item) finalEquip.push({ ...item, quantity: 1, id: uuidv4() });
                        }
                    }
                });
            } else if (mainOption.option_type === 'choice') {
                const subSelection = selection.sub?.[0];
                if(subSelection) {
                    const item = allEquipment.find(e => e.index === subSelection);
                    if (item) finalEquip.push({ ...item, quantity: 1, id: uuidv4() });
                }
            }
        });

        const allChoicesMade = choiceGroups.every(group => {
            const selection = equipmentSelections[group.id];
            if (selection?.main === undefined || selection.main < 0) return false;

            const mainOption = group.choice.from.options[selection.main];
            if (!mainOption) return false;

            if (mainOption.option_type === 'multiple' && Array.isArray(mainOption.items)) {
                return mainOption.items.every((subOption, subIndex) => {
                    if (subOption.option_type === 'choice') {
                        return selection.sub && selection.sub[subIndex];
                    }
                    return true;
                });
            }
            if (mainOption.option_type === 'choice') {
                return selection.sub && selection.sub[0];
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

    