// src/components/NewCreationCharacter/NewStep5_Equipment.tsx
// Esta é a quinta etapa do "wizard", focada na seleção de equipamentos.
// Ela foi completamente recriada para ser mais robusta, intuitiva e 100% dependente da API.
// A lógica complexa é abstraída pelo hook `newUseEquipment`.

import React from 'react';
import { useNewEquipment } from '@/hooks/newUseEquipment';
import { useNewCharacterCreation } from '@/hooks/newUseCharacterCreation';
import { Icons } from '../Icons';
import ItemCard from '../ItemCard';
import { translateEquipment } from '@/utils/translator';
import type { InventoryItem } from '@/types';


// As props vêm do hook de criação principal para acessar os detalhes da classe/antecedente
// e para atualizar o inventário finalizado.
interface Props {
    classDetails: ReturnType<typeof useNewCharacterCreation>['classDetails'];
    backgroundDetails: ReturnType<typeof useNewCharacterCreation>['backgroundDetails'];
    setFinalizedEquipment: ReturnType<typeof useNewCharacterCreation>['setFinalizedEquipment'];
    prevStep: () => void;
    nextStep: () => void;
}

const NewStep5_Equipment: React.FC<Props> = ({ classDetails, backgroundDetails, setFinalizedEquipment, prevStep, nextStep }) => {
    // O hook `useNewEquipment` gerencia todo o estado e lógica desta etapa.
    const {
        fixedEquipment,
        equipmentChoiceGroups,
        equipmentChoices,
        subChoiceOptions,
        subChoiceSelection,
        selectedEquipmentDetails,
        handleEquipmentChange,
        handleSubEquipmentChange,
        finalInventory,
        isEquipmentComplete,
        isEquipmentLoading,
    } = useNewEquipment(classDetails, backgroundDetails);

    // Atualiza o estado global de criação com o inventário final desta etapa.
    React.useEffect(() => {
        setFinalizedEquipment(finalInventory);
    }, [finalInventory, setFinalizedEquipment]);

    if (isEquipmentLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-stone-400">
                <Icons.Spinner className="h-12 w-12" />
                <p className="mt-4">Carregando arsenal...</p>
            </div>
        );
    }
    
    // Se não houver equipamentos fixos nem escolhas, podemos pular esta etapa.
    if(fixedEquipment.length === 0 && equipmentChoiceGroups.length === 0) {
         return (
            <div className="space-y-8 animate-fadeIn text-center">
                <p className="text-stone-400 italic">Sua classe e antecedente não fornecem equipamentos iniciais.</p>
                 <div className="flex justify-center pt-8">
                    <button type="button" onClick={nextStep} className="menu-button btn-new max-w-xs">
                        Avançar
                        <Icons.Play className="h-6 w-6 ml-3 transform -rotate-90 scale-y-150" />
                    </button>
                </div>
            </div>
         )
    }

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Seção 1: Itens Fixos */}
            {fixedEquipment.length > 0 && (
                <div className="bg-stone-900/50 p-4 rounded-lg border border-stone-700">
                    <h3 className="font-semibold text-amber-300 mb-3 text-lg">Equipamento Concedido</h3>
                    <ul className="list-disc list-inside text-stone-300 space-y-1 text-sm columns-2">
                        {fixedEquipment.map(eq => (
                            <li key={eq.item.index}>{translateEquipment(eq.item.name)} (x{eq.quantity})</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Seção 2: Grupos de Escolha */}
            {equipmentChoiceGroups.length > 0 && (
                <div className="space-y-6">
                    {equipmentChoiceGroups.map(group => {
                        const mainSelection = equipmentChoices[group.id];
                        const subSelection = subChoiceSelection[group.id];
                        const subOptions = subChoiceOptions[group.id];
                        
                        const itemDetailsKey = subSelection ? `subchoice-${group.id}` : (mainSelection?.of?.index ? `choice-${group.id}`: null);
                        const itemDetails = itemDetailsKey ? selectedEquipmentDetails[itemDetailsKey] : null;

                        return (
                            <div key={group.id} className="bg-stone-900/50 p-4 rounded-lg border border-stone-700 space-y-3">
                                <h3 className="font-semibold text-amber-300 text-lg">{group.desc}</h3>
                                
                                {/* Select Principal */}
                                {group.choice.from.options && (
                                    <select
                                        value={group.choice.from.options.findIndex(o => JSON.stringify(o) === JSON.stringify(mainSelection))}
                                        onChange={(e) => handleEquipmentChange(group.id, e.target.value)}
                                        className="w-full bg-stone-900/70 border border-stone-700 rounded-md p-3 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                                    >
                                        <option value={-1}>Selecione uma opção...</option>
                                        {group.choice.from.options.map((opt, index) => (
                                            <option key={index} value={index}>
                                                {translateEquipment(opt.desc || opt.of?.name || "Opção de Equipamento")}
                                            </option>
                                        ))}
                                    </select>
                                )}
                                
                                {/* Select de Sub-escolha (dinâmico) */}
                                {subOptions && (
                                     <div className="pl-4 border-l-2 border-stone-600">
                                        <select
                                            value={subSelection || ''}
                                            onChange={(e) => handleSubEquipmentChange(group.id, e.target.value)}
                                            disabled={subOptions.isLoading}
                                            className="w-full bg-stone-900/70 border border-stone-700 rounded-md p-3 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50"
                                        >
                                            <option value="">{subOptions.isLoading ? 'Carregando...' : 'Selecione o item específico...'}</option>
                                            {subOptions.options.map(item => (
                                                <option key={item.index} value={item.index}>{item.name}</option>
                                            ))}
                                        </select>
                                     </div>
                                )}

                                {/* Preview do Item Selecionado */}
                                {itemDetails && (
                                    <div className="pl-4 border-l-2 border-stone-600 pt-2">
                                        <ItemCard item={{...itemDetails, id: 'temp-preview'} as InventoryItem} defaultExpanded />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Navegação */}
            <div className="flex justify-between pt-8">
                <button type="button" onClick={prevStep} className="menu-button btn-import max-w-xs">
                    <Icons.Play className="h-6 w-6 mr-3 transform rotate-90 scale-y-150" />
                    Voltar
                </button>
                <button type="button" onClick={nextStep} disabled={!isEquipmentComplete} className="menu-button btn-new max-w-xs disabled:opacity-50 disabled:cursor-not-allowed">
                    {isEquipmentComplete ? 'Avançar' : 'Faça suas escolhas'}
                    <Icons.Play className="h-6 w-6 ml-3 transform -rotate-90 scale-y-150" />
                </button>
            </div>
        </div>
    );
};

export default NewStep5_Equipment;
