// src/components/NewCreationCharacter/NewSubEquipment.tsx
import React from 'react';
import { ApiEquipmentOption, InventoryItem, ApiListItem } from '../../types';
import ItemCard from '../ItemCard';
import { getOptionLabel } from '../../utils/creationHelpers';

interface Props {
    groupId: string;
    choice: ApiEquipmentOption;
    equipmentChoices: Record<string, ApiEquipmentOption | null>;
    subChoiceOptions: Record<string, { isLoading: boolean, options: ApiListItem[] }>;
    subChoiceSelection: Record<string, string>;
    selectedEquipmentDetails: Record<string, Partial<InventoryItem> | null>;
    onEquipmentChange: (groupId: string, optionIdxString: string) => void;
    onSubEquipmentChange: (groupId: string, itemIndex: string) => void;
}

const NewSubEquipment: React.FC<Props> = ({
    groupId,
    choice,
    equipmentChoices,
    subChoiceOptions,
    subChoiceSelection,
    selectedEquipmentDetails,
    onEquipmentChange,
    onSubEquipmentChange
}) => {
    const selectedOption = equipmentChoices[groupId];
    const subChoiceData = subChoiceOptions[groupId];
    
    // Determina qual detalhe de item exibir: o da sub-escolha ou o da escolha principal.
    const detailKey = subChoiceSelection[groupId]
        ? `subchoice-${groupId}`
        : (selectedOption?.of?.index ? `choice-${groupId}` : null);
    const itemDetails = detailKey ? selectedEquipmentDetails[detailKey] : null;

    const selectedTopLevelIndex = selectedOption && choice.from.options 
        ? choice.from.options.findIndex(o => JSON.stringify(o) === JSON.stringify(selectedOption)) 
        : -1;

    return (
        <div className="pl-4 border-l-2 border-stone-700/50">
            {/* Menu Suspenso Principal */}
            <label htmlFor={`equip-choice-${groupId}`} className="block text-stone-300 font-semibold mb-2 text-sm">{choice.desc}</label>
            <select
                id={`equip-choice-${groupId}`}
                value={selectedTopLevelIndex > -1 ? selectedTopLevelIndex : ""}
                onChange={e => onEquipmentChange(groupId, e.target.value)}
                required
                className="w-full bg-stone-800/70 border border-stone-600 rounded-md p-2 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
                <option value="" disabled>Selecione uma opção...</option>
                {choice.from.options?.map((option, optIndex) => (
                    <option key={optIndex} value={optIndex}>{getOptionLabel(option)}</option>
                ))}
            </select>

            {/* Menu Suspenso para Sub-escolhas (Categorias) */}
            {selectedOption?.type === 'choice' && (
                <div className="mt-3">
                    {subChoiceData?.isLoading ? (
                         <div className="w-full bg-stone-800/70 border border-stone-600 rounded-md p-2 text-stone-400 italic">
                            Carregando opções...
                        </div>
                    ) : (
                        <select
                            id={`sub-equip-choice-${groupId}`}
                            value={subChoiceSelection[groupId] || ''}
                            onChange={e => onSubEquipmentChange(groupId, e.target.value)}
                            required
                            className="w-full bg-stone-800/70 border border-stone-600 rounded-md p-2 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        >
                            <option value="" disabled>Selecione um item específico...</option>
                            {subChoiceData?.options.map(item => (
                                <option key={item.index} value={item.index}>{item.name}</option>
                            ))}
                        </select>
                    )}
                </div>
            )}
            
            {/* Exibição do Card de Detalhes do Item */}
            {itemDetails && (
                <div className="mt-3">
                    <ItemCard item={{ ...itemDetails, id: 'temp-display', quantity: itemDetails.quantity || 1 } as InventoryItem} defaultExpanded />
                </div>
            )}
        </div>
    );
};

export default NewSubEquipment;
