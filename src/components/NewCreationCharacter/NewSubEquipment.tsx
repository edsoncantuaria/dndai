// src/components/NewCreationCharacter/NewSubEquipment.tsx
import React from 'react';
import { useNewCharacterCreation, EquipmentChoiceGroup } from '@/hooks/newUseCharacterCreation';
import { getOptionLabel } from '@/utils/creationHelpers';
import { Icons } from '../Icons';

interface NewSubEquipmentProps {
    group: EquipmentChoiceGroup;
    hook: ReturnType<typeof useNewCharacterCreation>;
}

const NewSubEquipment: React.FC<NewSubEquipmentProps> = ({ group, hook }) => {
    const {
        equipmentSelections,
        handleEquipmentChange,
        subChoiceOptions,
        isSubchoiceLoading,
    } = hook;

    const mainSelectionIndex = equipmentSelections[group.id]?.main;
    const subSelectionIndex = equipmentSelections[group.id]?.sub;

    const options = group.choice.from.options || [];

    return (
        <div className="bg-stone-800/60 p-4 rounded-lg border border-stone-700 space-y-3">
            <h5 className="font-semibold text-stone-300">{group.choice.desc || `Escolha de ${group.source}`}</h5>
            
            {/* Select Principal */}
            {options && (
                <select
                    value={mainSelectionIndex ?? -1}
                    onChange={(e) => handleEquipmentChange(group.id, e.target.value)}
                    className="w-full bg-stone-900/70 border border-stone-700 rounded-md p-3 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                >
                    <option value={-1} disabled>Selecione uma opção...</option>
                    {options.map((opt, index) => (
                        <option key={index} value={index}>
                            {getOptionLabel(opt)}
                        </option>
                    ))}
                </select>
            )}

            {/* Select de Sub-escolha (condicional) */}
            {isSubchoiceLoading[group.id] ? (
                <div className="flex items-center justify-center p-2 text-stone-400">
                    <Icons.Spinner />
                    <span className="ml-2 text-sm">Carregando...</span>
                </div>
            ) : subChoiceOptions[group.id] && mainSelectionIndex !== undefined && (
                <select
                    value={subSelectionIndex ?? -1}
                    onChange={(e) => handleEquipmentChange(group.id, mainSelectionIndex.toString(), e.target.value)}
                    className="w-full bg-stone-900/70 border border-stone-700 rounded-md p-3 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 animate-fadeIn"
                >
                    <option value={-1} disabled>Selecione um item específico...</option>
                    {subChoiceOptions[group.id]!.map((item, index) => (
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
