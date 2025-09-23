import React from 'react';
import { useCharacterCreation } from '../../hooks/useCharacterCreation';
import { ApiEquipmentOption, InventoryItem } from '../../types';
import ItemCard from '../ItemCard';
import { translateEquipment } from '@/utils/TranslatorEquipments';

interface EquipmentChoicesProps {
    hook: ReturnType<typeof useCharacterCreation>;
}

const getOptionLabel = (option: ApiEquipmentOption): string => {
    if (!option) return 'Opção Inválida';
    
    // Para escolhas de categoria, ex: "Qualquer Arma Simples"
    if (option.type === 'choice' && option.from.option_set_type === 'equipment_category') {
         const categoryName = option.from.equipment_category?.name || 'Equipamento';
         return `Qualquer ${translateEquipment(categoryName)}`;
    }
    
    // Para itens diretos
    if (option.of) {
        const count = (option.count || 1) > 1 ? ` (x${option.count})` : '';
        return `${translateEquipment(option.of.name)}${count}`;
    }
    
    // Para escolhas múltiplas
    if (option.type === 'multiple' && option.from.options) {
        return option.from.options.map(o => getOptionLabel(o.item || o)).join(' + ');
    }

    // Fallback para descrições
    if (option.desc) return translateEquipment(option.desc);

    return 'Opção de Equipamento';
};

const EquipmentChoices: React.FC<EquipmentChoicesProps> = ({ hook }) => {
    const {
        equipmentChoiceGroups,
        fixedEquipment,
        equipmentChoices,
        subChoiceOptions,
        subChoiceSelection,
        selectedEquipmentDetails,
        handleEquipmentChange,
        handleSubEquipmentChange,
    } = hook;

    if (equipmentChoiceGroups.length === 0 && fixedEquipment.length === 0) {
        return null;
    }

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold font-garamond text-amber-300 border-b border-stone-700 pb-2 text-shadow-amber">Equipamento Inicial</h3>
            
            {fixedEquipment.length > 0 && (
                <div>
                    <h4 className="font-semibold text-stone-300 mb-2">Itens Fixos:</h4>
                    <ul className="list-disc list-inside text-stone-400 space-y-1 text-sm columns-2">
                        {fixedEquipment.map(item => item.item?.name && (
                            <li key={item.item.index}>{translateEquipment(item.item.name)} (x{item.quantity})</li>
                        ))}
                    </ul>
                </div>
            )}

            {equipmentChoiceGroups.map((group) => (
                <div key={group.desc} className="space-y-4">
                    <h4 className="font-semibold text-stone-300">{group.desc}</h4>
                    {group.choices.map((choice, index) => {
                        const choiceKey = `${group.desc}-${index}`;
                        const selectedOption = equipmentChoices[choiceKey];
                        const detailKey = subChoiceSelection[choiceKey] 
                            ? `subchoice-${choiceKey}` 
                            : (selectedOption?.of?.index ? `choice-${choiceKey}` : null);
                        const itemDetails = detailKey ? selectedEquipmentDetails[detailKey] : null;

                        return (
                            <div key={choiceKey}>
                                <label htmlFor={`equip-choice-${choiceKey}`} className="block text-stone-300 font-semibold mb-2">{choice.desc}</label>
                                <select 
                                    id={`equip-choice-${choiceKey}`} 
                                    value={selectedOption && choice.from.options ? choice.from.options.findIndex(o => JSON.stringify(o) === JSON.stringify(selectedOption)) : ""}
                                    onChange={e => handleEquipmentChange(group.desc, index, e.target.value)} 
                                    required 
                                    className="w-full bg-stone-700 border border-stone-600 rounded-md p-2 text-stone-200 focus:ring-amber-500 focus:border-amber-500"
                                >
                                    <option value="" disabled>Selecione uma opção...</option>
                                    {choice.from.options?.map((option, optIndex) => (
                                        <option key={optIndex} value={optIndex}>{getOptionLabel(option)}</option>
                                    ))}
                                </select>
                                
                                {selectedOption?.type === 'choice' && subChoiceOptions[choiceKey] && (
                                    <div className="mt-2 pl-4 border-l-2 border-stone-600">
                                        <label htmlFor={`sub-equip-choice-${choiceKey}`} className="block text-stone-400 font-semibold text-sm mb-1">Selecione o item específico:</label>
                                        <select
                                            id={`sub-equip-choice-${choiceKey}`}
                                            value={subChoiceSelection[choiceKey] || ''}
                                            onChange={e => handleSubEquipmentChange(group.desc, index, e.target.value)}
                                            required
                                            className="w-full bg-stone-700 border border-stone-600 rounded-md p-2 text-stone-200 focus:ring-amber-500 focus:border-amber-500"
                                        >
                                            <option value="" disabled>Selecione...</option>
                                            {subChoiceOptions[choiceKey]?.map(item => (
                                                <option key={item.index} value={item.index}>{translateEquipment(item.name)}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {itemDetails && (
                                    <div className="mt-2 pl-4 border-l-2 border-stone-600">
                                        <ItemCard item={{...itemDetails, id: 'temp-display', quantity: itemDetails.quantity || 1} as InventoryItem} defaultExpanded />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            ))}
        </div>
    );
};

export default EquipmentChoices;
