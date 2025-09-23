// src/components/NewCreationCharacter/NewStep5_Equipment.tsx
import React from 'react';
import { ApiEquipmentOption, InventoryItem } from '@/types';
import { translateApiString, translateEquipment } from '@/utils/translator';
import { Icons } from '../Icons';
import ItemCard from '../ItemCard';
import { useNewCharacterCreation } from '@/hooks/newUseCharacterCreation';


// Helper para gerar um rótulo legível para as opções de equipamento
const getOptionLabel = (option: ApiEquipmentOption): string => {
    if (!option) return 'Opção Inválida';

    if (option.desc) return translateApiString(option.desc);
    
    if (option.type === 'choice' && option.from.option_set_type === 'equipment_category') {
         const categoryName = option.from.equipment_category?.name || 'Equipamento';
         return `Qualquer ${translateApiString(categoryName)}`;
    }
    
    if (option.of) {
        const count = (option.count || 1) > 1 ? ` (x${option.count})` : '';
        return `${translateEquipment(option.of.name)}${count}`;
    }
    
    if (option.type === 'multiple' && option.from.options) {
        return option.from.options.map(o => getOptionLabel(o.item || o)).join(' + ');
    }

    return 'Opção de Equipamento';
};


interface Props {
    equipmentChoiceGroups: ReturnType<typeof useNewCharacterCreation>['equipmentChoiceGroups'];
    fixedEquipment: ReturnType<typeof useNewCharacterCreation>['fixedEquipment'];
    equipmentChoices: ReturnType<typeof useNewCharacterCreation>['equipmentChoices'];
    subChoiceOptions: ReturnType<typeof useNewCharacterCreation>['subChoiceOptions'];
    subChoiceSelection: ReturnType<typeof useNewCharacterCreation>['subChoiceSelection'];
    selectedEquipmentDetails: ReturnType<typeof useNewCharacterCreation>['selectedEquipmentDetails'];
    handleEquipmentChange: ReturnType<typeof useNewCharacterCreation>['handleEquipmentChange'];
    handleSubEquipmentChange: ReturnType<typeof useNewCharacterCreation>['handleSubEquipmentChange'];
    prevStep: () => void;
    nextStep: () => void;
}

const NewStep5_Equipment: React.FC<Props> = ({
    equipmentChoiceGroups,
    fixedEquipment,
    equipmentChoices,
    subChoiceOptions,
    subChoiceSelection,
    selectedEquipmentDetails,
    handleEquipmentChange,
    handleSubEquipmentChange,
    prevStep,
    nextStep,
}) => {

    const canProceed = equipmentChoiceGroups.every(group =>
        group.choices.every((choice, index) => {
            const choiceKey = `${group.desc}-${index}`;
            const selection = equipmentChoices[choiceKey];
            if (!selection) return false;
            if (selection.type === 'choice' && !subChoiceSelection[choiceKey]) return false;
            return true;
        })
    );

    return (
        <div className="space-y-8 animate-fadeIn">
            <div>
                <h3 className="text-xl font-semibold text-stone-300 mb-2">Equipamento Inicial</h3>
                <p className="text-sm text-stone-400 mb-6">Sua classe e antecedente fornecem seu equipamento inicial. Faça suas escolhas abaixo.</p>
            </div>

            {/* Equipamento Fixo */}
            {fixedEquipment.length > 0 && (
                <div className="bg-stone-900/50 p-4 rounded-lg border border-stone-700">
                    <h4 className="font-semibold text-amber-300 mb-3">Itens Concedidos</h4>
                    <ul className="list-disc list-inside text-stone-400 space-y-1 text-sm columns-2 md:columns-3">
                         {fixedEquipment.map(item => item.item?.name && (
                            <li key={item.item.index}>{translateEquipment(item.item.name)} (x{item.quantity})</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Escolhas de Equipamento */}
            <div className="space-y-6">
                {equipmentChoiceGroups.map((group) => (
                    <div key={group.desc} className="bg-stone-900/50 p-4 rounded-lg border border-stone-700">
                         <h4 className="font-semibold text-amber-300 mb-4">{group.desc}</h4>
                         <div className="space-y-4">
                            {group.choices.map((choice, index) => {
                                const choiceKey = `${group.desc}-${index}`;
                                const selectedOption = equipmentChoices[choiceKey];
                                 const detailKey = subChoiceSelection[choiceKey] 
                                    ? `subchoice-${choiceKey}` 
                                    : (selectedOption?.of?.index ? `choice-${choiceKey}` : null);
                                const itemDetails = detailKey ? selectedEquipmentDetails[detailKey] : null;

                                return (
                                    <div key={choiceKey} className="pl-4 border-l-2 border-stone-700">
                                        <label htmlFor={`equip-choice-${choiceKey}`} className="block text-stone-300 font-semibold mb-2 text-sm">{choice.desc}</label>
                                        <select 
                                            id={`equip-choice-${choiceKey}`} 
                                            value={selectedOption && choice.from.options ? choice.from.options.indexOf(selectedOption) : ""}
                                            onChange={e => handleEquipmentChange(group.desc, index, e.target.value)} 
                                            required 
                                            className="w-full bg-stone-800/70 border border-stone-600 rounded-md p-2 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                        >
                                            <option value="" disabled>Selecione uma opção...</option>
                                            {choice.from.options?.map((option, optIndex) => (
                                                <option key={optIndex} value={optIndex}>{getOptionLabel(option.item || option)}</option>
                                            ))}
                                        </select>
                                        
                                        {/* Dropdown secundário para escolhas de categoria */}
                                        {selectedOption?.type === 'choice' && subChoiceOptions[choiceKey] && (
                                            <div className="mt-3">
                                                <select
                                                    id={`sub-equip-choice-${choiceKey}`}
                                                    value={subChoiceSelection[choiceKey] || ''}
                                                    onChange={e => handleSubEquipmentChange(group.desc, index, e.target.value)}
                                                    required
                                                    className="w-full bg-stone-800/70 border border-stone-600 rounded-md p-2 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                                >
                                                    <option value="" disabled>Selecione um item específico...</option>
                                                    {subChoiceOptions[choiceKey]?.map(item => (
                                                        <option key={item.index} value={item.index}>{translateEquipment(item.name)}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                        {/* Card com detalhes do item selecionado */}
                                        {itemDetails && (
                                            <div className="mt-3">
                                                <ItemCard item={{...itemDetails, id: 'temp-display', quantity: itemDetails.quantity || 1} as InventoryItem} defaultExpanded />
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                         </div>
                    </div>
                ))}
            </div>

            {/* Navegação */}
             <div className="flex justify-between pt-8">
                <button type="button" onClick={prevStep} className="menu-button btn-import max-w-xs">
                    <Icons.Play className="h-6 w-6 mr-3 transform rotate-90 scale-y-150" />
                    Voltar
                </button>
                <button type="button" onClick={nextStep} disabled={!canProceed} className="menu-button btn-new max-w-xs disabled:opacity-50 disabled:cursor-not-allowed">
                    {canProceed ? 'Avançar' : 'Faça suas escolhas'}
                    <Icons.Play className="h-6 w-6 ml-3 transform -rotate-90 scale-y-150" />
                </button>
            </div>
        </div>
    );
};

export default NewStep5_Equipment;
