// src/components/NewCreationCharacter/NewEquipment.tsx
import React from 'react';
import { useNewEquipment } from '../../hooks/newUseEquipment';
import NewSubEquipment from './NewSubEquipment';
import { translateEquipment } from '../../utils/TranslatorEquipments';
import { Icons } from '../Icons';

interface Props {
    hook: ReturnType<typeof useNewEquipment>;
}

const NewEquipment: React.FC<Props> = ({ hook }) => {
    const {
        fixedEquipment,
        equipmentChoiceGroups,
        equipmentChoices,
        subChoiceOptions,
        subChoiceSelection,
        selectedEquipmentDetails,
        handleEquipmentChange,
        handleSubEquipmentChange,
        isEquipmentLoading,
    } = hook;

    return (
        <div className="space-y-8">
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

            {isEquipmentLoading ? (
                 <div className="flex flex-col items-center justify-center p-8 text-stone-400">
                    <Icons.Spinner className="h-12 w-12" />
                    <p className="mt-4">Carregando opções de equipamento...</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {equipmentChoiceGroups.map((group) => (
                        <div key={group.id} className="bg-stone-900/50 p-4 rounded-lg border border-stone-700">
                            <h4 className="font-semibold text-amber-300 mb-4">{group.desc}</h4>
                            <div className="space-y-4">
                                <NewSubEquipment
                                    groupId={group.id}
                                    choice={group.choice}
                                    onEquipmentChange={handleEquipmentChange}
                                    onSubEquipmentChange={handleSubEquipmentChange}
                                    equipmentChoices={equipmentChoices}
                                    subChoiceOptions={subChoiceOptions}
                                    subChoiceSelection={subChoiceSelection}
                                    selectedEquipmentDetails={selectedEquipmentDetails}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default NewEquipment;
