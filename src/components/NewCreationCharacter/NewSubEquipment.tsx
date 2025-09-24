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
    const {
        equipmentSelections,
        handleEquipmentChange,
    } = hook;
    
    const [subOptions, setSubOptions] = useState<ApiListItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const mainSelectionIndex = equipmentSelections[group.id]?.main;
    const subSelectionIndex = equipmentSelections[group.id]?.sub;
    const mainOptions = group.choice.from.options || [];

    useEffect(() => {
        const fetchSubOptions = async () => {
            const selection = equipmentSelections[group.id];
            
            // Determine which category to fetch based on the selection type
            let categoryToFetch: string | undefined = undefined;

            // Case 1: The entire group is a direct equipment category choice.
            if (group.choice.from.option_set_type === 'equipment_category' && group.choice.from.equipment_category?.index) {
                categoryToFetch = group.choice.from.equipment_category.index;
            }
            // Case 2: The selected main option is a choice of a category.
            else if (selection?.main !== undefined) {
                const mainOption = mainOptions[selection.main];
                if (mainOption?.option_type === 'choice' && mainOption.choice?.from.equipment_category?.index) {
                    categoryToFetch = mainOption.choice.from.equipment_category.index;
                }
            }

            if (categoryToFetch) {
                setIsLoading(true);
                const categoryData = await DndApiService.getEquipmentForCategory(categoryToFetch);
                setSubOptions(categoryData?.equipment || []);
                setIsLoading(false);
            } else {
                setSubOptions([]);
            }
        };

        fetchSubOptions();
    }, [group.id, mainSelectionIndex, group.choice]);


    // A direct category choice (like Acolyte's Holy Symbol).
    // We render a select with a single option to standardize the UX.
    if (group.choice.from.option_set_type === 'equipment_category') {
        const categoryName = group.choice.from.equipment_category?.name || "Categoria";
        return (
             <div className="bg-stone-800/60 p-4 rounded-lg border border-stone-700 space-y-3">
                <h5 className="font-semibold text-stone-300">{group.choice.desc || `Escolha de ${group.source}`}</h5>
                
                {/* Dummy select to show the category name */}
                <select
                    value={mainSelectionIndex ?? 0}
                    onChange={(e) => handleEquipmentChange(group.id, e.target.value)}
                    className="w-full bg-stone-900/70 border border-stone-700 rounded-md p-3 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                >
                    <option value={0}>{getOptionLabel(group.choice.from.equipment_category as any, true)}</option>
                </select>

                {isLoading ? (
                     <div className="flex items-center justify-center p-2 text-stone-400">
                        <Loader2 className="animate-spin" />
                        <span className="ml-2 text-sm">Carregando...</span>
                    </div>
                ) : subOptions.length > 0 && (
                    <select
                        value={subSelectionIndex ?? -1}
                        onChange={(e) => handleEquipmentChange(group.id, mainSelectionIndex?.toString(), e.target.value)}
                        className="w-full bg-stone-900/70 border border-stone-700 rounded-md p-3 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 animate-fadeIn"
                    >
                         <option value={-1} disabled>Selecione um item...</option>
                         {subOptions.map((item, index) => (
                            <option key={item.index} value={index}>
                                {item.name}
                            </option>
                        ))}
                    </select>
                )}
            </div>
        );
    }
    
    // A choice between specific items or other categories
    return (
        <div className="bg-stone-800/60 p-4 rounded-lg border border-stone-700 space-y-3">
            <h5 className="font-semibold text-stone-300">{group.choice.desc || `Escolha de ${group.source}`}</h5>
            
            <select
                value={mainSelectionIndex ?? -1}
                onChange={(e) => handleEquipmentChange(group.id, e.target.value)}
                className="w-full bg-stone-900/70 border border-stone-700 rounded-md p-3 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
                <option value={-1} disabled>Selecione uma opção...</option>
                {mainOptions.map((opt, index) => (
                    <option key={index} value={index}>
                        {getOptionLabel(opt)}
                    </option>
                ))}
            </select>

            {isLoading ? (
                <div className="flex items-center justify-center p-2 text-stone-400">
                    <Loader2 className="animate-spin" />
                    <span className="ml-2 text-sm">Carregando...</span>
                </div>
            ) : subOptions.length > 0 && (
                <select
                    value={subSelectionIndex ?? -1}
                    onChange={(e) => handleEquipmentChange(group.id, mainSelectionIndex?.toString(), e.target.value)}
                    className="w-full bg-stone-900/70 border border-stone-700 rounded-md p-3 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 animate-fadeIn"
                >
                    <option value={-1} disabled>Selecione um item específico...</option>
                    {subOptions.map((item, index) => (
                        <option key={item.index} value={index}>
                            {item.name}
                        </option>
                    ))}
                </select>
            )}
        </div>
    );
};

export default NewSubEquipment;
