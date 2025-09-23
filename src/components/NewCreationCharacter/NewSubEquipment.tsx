// src/components/NewCreationCharacter/NewSubEquipment.tsx
import React from 'react';
import { ApiEquipmentOption, InventoryItem, ApiListItem } from '../../types';
import ItemCard from '../ItemCard';
import { translateEquipment } from '../../utils/TranslatorEquipments';
import { getOptionLabel } from '../../utils/creationHelpers';

interface Props {
    groupId: string;
    choiceIndex: number;
    choice: ApiEquipmentOption;
    equipmentChoices: Record<string, ApiEquipmentOption>;
    subChoiceOptions: Record<string, ApiListItem[]>;
    subChoiceSelection: Record<string, string>;
    selectedEquipmentDetails: Record<string, Partial<InventoryItem> | null>;
    onEquipmentChange: (groupId: string, choiceIndex: number, optionIdxString: string) => void;
    onSubEquipmentChange: (groupId: string, choiceIndex: number, itemIndex: string) => void;
}

const NewSubEquipment: React.FC<Props> = ({
    groupId,
    choiceIndex,
    choice,
    equipmentChoices,
    subChoiceOptions,
    subChoiceSelection,
    selectedEquipmentDetails,
    onEquipmentChange,
    onSubEquipmentChange
}) => {
    const choiceKey = `${groupId}-${choiceIndex}`;
    const selectedOption = equipmentChoices[choiceKey];
    
    // Determina qual detalhe de item exibir: o da sub-escolha ou o da escolha principal.
    const detailKey = subChoiceSelection[choiceKey]
        ? `subchoice-${choiceKey}`
        : (selectedOption?.of?.index ? `choice-${choiceKey}` : null);
    const itemDetails = detailKey ? selectedEquipmentDetails[detailKey] : null;

    return (
        <div className="pl-4 border-l-2 border-stone-700/50">
            {/* Menu Suspenso Principal */}
            <label htmlFor={`equip-choice-${choiceKey}`} className="block text-stone-300 font-semibold mb-2 text-sm">{choice.desc}</label>
            <select
                id={`equip-choice-${choiceKey}`}
                value={selectedOption && choice.from.options ? choice.from.options.findIndex(o => JSON.stringify(o) === JSON.stringify(selectedOption)) : ""}
                onChange={e => onEquipmentChange(groupId, choiceIndex, e.target.value)}
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
                    {subChoiceOptions[choiceKey] ? (
                        <select
                            id={`sub-equip-choice-${choiceKey}`}
                            value={subChoiceSelection[choiceKey] || ''}
                            onChange={e => onSubEquipmentChange(groupId, choiceIndex, e.target.value)}
                            required
                            className="w-full bg-stone-800/70 border border-stone-600 rounded-md p-2 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        >
                            <option value="" disabled>Selecione um item específico...</option>
                            {subChoiceOptions[choiceKey]?.map(item => (
                                <option key={item.index} value={item.index}>{translateEquipment(item.name)}</option>
                            ))}
                        </select>
                    ) : (
                        <div className="w-full bg-stone-800/70 border border-stone-600 rounded-md p-2 text-stone-400 italic">
                            Carregando opções...
                        </div>
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
