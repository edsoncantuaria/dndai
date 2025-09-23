// src/components/NewCreationCharacter/NewEquipment.tsx
import React from 'react';
import { ApiEquipmentOption } from '../../types';
import { useNewEquipment } from '../../hooks/newUseEquipment';
import { ApiClass, ApiBackground } from '../../types';
import NewSubEquipment from './NewSubEquipment';
import { translateEquipment } from '../../utils/TranslatorEquipments';
import { Icons } from '../Icons';

interface Props {
    classDetails: ApiClass | null;
    backgroundDetails: ApiBackground | null;
    prevStep: () => void;
    nextStep: () => void;
    // Adicione a prop para passar o inventário final para o hook principal
    onEquipmentFinalized: (inventory: any[]) => void;
}

const NewEquipment: React.FC<Props> = ({ classDetails, backgroundDetails, prevStep, nextStep, onEquipmentFinalized }) => {
    const {
        fixedEquipment,
        equipmentChoiceGroups,
        equipmentChoices,
        subChoiceOptions,
        subChoiceSelection,
        selectedEquipmentDetails,
        handleEquipmentChange,
        handleSubEquipmentChange,
        isEquipmentComplete,
        finalInventory
    } = useNewEquipment(classDetails, backgroundDetails);

    const handleNext = () => {
        onEquipmentFinalized(finalInventory);
        nextStep();
    }

    return (
        <div className="space-y-8 animate-fadeIn">
            <div>
                <h3 className="text-xl font-semibold text-stone-300 mb-2">Equipamento Inicial</h3>
                <p className="text-sm text-stone-400 mb-6">Sua classe e antecedente fornecem seu equipamento inicial. Faça suas escolhas abaixo.</p>
            </div>

            {/* Equipamentos Concedidos */}
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

            {/* Grupos de Escolha de Equipamento */}
            <div className="space-y-6">
                {equipmentChoiceGroups.map((group) => (
                    <div key={group.id} className="bg-stone-900/50 p-4 rounded-lg border border-stone-700">
                        <h4 className="font-semibold text-amber-300 mb-4">{group.desc}</h4>
                        <div className="space-y-4">
                            {group.choices.map((choice, index) => (
                                <NewSubEquipment
                                    key={`${group.id}-${index}`}
                                    groupId={group.id}
                                    choiceIndex={index}
                                    choice={choice}
                                    onEquipmentChange={handleEquipmentChange}
                                    onSubEquipmentChange={handleSubEquipmentChange}
                                    equipmentChoices={equipmentChoices}
                                    subChoiceOptions={subChoiceOptions}
                                    subChoiceSelection={subChoiceSelection}
                                    selectedEquipmentDetails={selectedEquipmentDetails}
                                />
                            ))}
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
                <button type="button" onClick={handleNext} disabled={!isEquipmentComplete} className="menu-button btn-new max-w-xs disabled:opacity-50 disabled:cursor-not-allowed">
                    {isEquipmentComplete ? 'Avançar' : 'Faça suas escolhas'}
                    <Icons.Play className="h-6 w-6 ml-3 transform -rotate-90 scale-y-150" />
                </button>
            </div>
        </div>
    );
};

export default NewEquipment;
