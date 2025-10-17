// src/components/NewCreationCharacter/NewSubEquipment.tsx
import React, { useEffect, useState } from 'react';
import { useNewCharacterCreation, EquipmentChoiceGroup } from '@/hooks/newUseCharacterCreation';
import { getOptionLabel } from '@/utils/creationHelpers';
import * as DndApiService from '@/services/dndApiService';
import type { ApiListItem } from '@/types';
import { Loader2 } from 'lucide-react';

interface NewSubEquipmentProps {
    group: EquipmentChoiceGroup;
    hook: ReturnType<typeof useNewCharacterCreation>;
}

const NewSubEquipment: React.FC<NewSubEquipmentProps> = ({ group, hook }) => {
    const { equipmentSelections, setEquipmentSelections } = hook;
    
    const [subOptions, setSubOptions] = useState<ApiListItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const mainSelectionIndex = equipmentSelections[group.id]?.main;
    const subSelectionIndex = equipmentSelections[group.id]?.sub;
    const mainOptions = group.choice.from.options || [];

    const handleEquipmentChange = (groupId: string, mainIndexStr?: string, subIndexStr?: string) => {
        setEquipmentSelections(prev => {
            const newSelections = { ...prev };
            const currentSelection = newSelections[groupId] || {};
            const mainIndex = mainIndexStr !== undefined ? parseInt(mainIndexStr, 10) : currentSelection.main;
            const subIndex = subIndexStr !== undefined ? parseInt(subIndexStr, 10) : currentSelection.sub;

            if (mainIndexStr !== undefined && mainIndex !== currentSelection.main) {
                newSelections[groupId] = { main: mainIndex, sub: undefined };
            } else {
                newSelections[groupId] = { main: mainIndex, sub: subIndex };
            }
            return newSelections;
        });
    };

    useEffect(() => {
        const fetchSubOptions = async () => {
            let categoryToFetch: string | undefined = undefined;
            if (group.choice.from.option_set_type === 'equipment_category' && group.choice.from.equipment_category?.index) {
                categoryToFetch = group.choice.from.equipment_category.index;
            } else if (mainSelectionIndex !== undefined) {
                const mainOption = mainOptions[mainSelectionIndex];
                if (mainOption?.option_type === 'choice' && mainOption.choice?.from.equipment_category?.index) {
                    categoryToFetch = mainOption.choice.from.equipment_category.index;
                }
            }

            if (categoryToFetch) {
                setIsLoading(true);
                const data = await DndApiService.getEquipmentForCategory(categoryToFetch);
                setSubOptions(data?.equipment || []);
                setIsLoading(false);
            } else {
                setSubOptions([]);
            }
        };
        fetchSubOptions();
    }, [group.id, mainSelectionIndex, group.choice, mainOptions]);

    if (group.choice.from.option_set_type === 'equipment_category') {
        return (
             <div className="bg-stone-800/60 p-4 rounded-lg border border-stone-700 space-y-3">
                <h5 className="font-semibold text-stone-300">{group.choice.desc || `Escolha de ${group.source}`}</h5>
                <select value={0} disabled className="w-full bg-stone-900/70 border border-stone-700 rounded-md p-3 text-stone-200 cursor-not-allowed">
                    <option value={0}>{getOptionLabel(group.choice.from.equipment_category as any, true)}</option>
                </select>
                {isLoading ? <Loader2 className="animate-spin text-stone-400" /> : subOptions.length > 0 && (
                    <select value={subSelectionIndex ?? -1} onChange={(e) => handleEquipmentChange(group.id, "0", e.target.value)} className="w-full bg-stone-900/70 border border-stone-700 rounded-md p-3 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 animate-fadeIn">
                         <option value={-1} disabled>Selecione um item...</option>
                         {subOptions.map((item, index) => <option key={item.index} value={index}>{item.name}</option>)}
                    </select>
                )}
            </div>
        );
    }
    
    return (
        <div className="bg-stone-800/60 p-4 rounded-lg border border-stone-700 space-y-3">
            <h5 className="font-semibold text-stone-300">{group.choice.desc || `Escolha de ${group.source}`}</h5>
            <select value={mainSelectionIndex ?? -1} onChange={(e) => handleEquipmentChange(group.id, e.target.value)} className="w-full bg-stone-900/70 border border-stone-700 rounded-md p-3 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500">
                <option value={-1} disabled>Selecione uma opção...</option>
                {mainOptions.map((opt, index) => <option key={index} value={index}>{getOptionLabel(opt)}</option>)}
            </select>
            {isLoading ? <Loader2 className="animate-spin text-stone-400" /> : subOptions.length > 0 && (
                <select value={subSelectionIndex ?? -1} onChange={(e) => handleEquipmentChange(group.id, mainSelectionIndex?.toString(), e.target.value)} className="w-full bg-stone-900/70 border border-stone-700 rounded-md p-3 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 animate-fadeIn">
                    <option value={-1} disabled>Selecione um item específico...</option>
                    {subOptions.map((item, index) => <option key={item.index} value={index}>{item.name}</option>)}
                </select>
            )}
        </div>
    );
};

export default NewSubEquipment;
