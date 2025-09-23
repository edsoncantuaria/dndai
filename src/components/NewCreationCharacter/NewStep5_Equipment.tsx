// src/components/NewCreationCharacter/NewStep5_Equipment.tsx
import React from 'react';
import { useNewCharacterCreation } from '@/hooks/newUseCharacterCreation';
import { Icons } from '../Icons';
import NewSubEquipment from './NewSubEquipment';
import { translateEquipment } from '@/utils/TranslatorEquipments';

interface Props {
    hook: ReturnType<typeof useNewCharacterCreation>;
    prevStep: () => void;
    nextStep: () => void;
}

const NewStep5_Equipment: React.FC<Props> = ({ hook, prevStep, nextStep }) => {
    const { 
        equipmentChoiceGroups,
        fixedEquipment,
        finalizedEquipment,
        isEquipmentLoading,
        areAllEquipmentChoicesMade,
        startingGold
    } = hook;

    return (
        <div className="space-y-8 animate-fadeIn">
            <div>
                <h3 className="text-xl font-semibold text-stone-300 mb-2">Equipamento Inicial</h3>
                <p className="text-sm text-stone-400 mb-6">Sua classe e antecedente fornecem seu equipamento inicial. Escolha suas opções abaixo.</p>
            </div>

            {isEquipmentLoading ? (
                <div className="flex flex-col items-center justify-center p-8 text-stone-400">
                    <Icons.Spinner className="h-12 w-12" />
                    <p className="mt-4">Carregando opções de equipamento...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Coluna de Escolhas */}
                    <div className="space-y-6">
                        <h4 className="font-semibold text-amber-300 mb-3 border-b border-stone-700 pb-2">Escolhas de Equipamento</h4>
                        {equipmentChoiceGroups.length > 0 ? (
                            equipmentChoiceGroups.map((group) => (
                                <NewSubEquipment key={group.id} group={group} hook={hook} />
                            ))
                        ) : (
                            <p className="text-stone-400 italic">Nenhuma escolha de equipamento necessária.</p>
                        )}
                    </div>
                    
                    {/* Coluna de Itens Finais */}
                    <div className="space-y-4">
                        <h4 className="font-semibold text-amber-300 mb-3 border-b border-stone-700 pb-2">Inventário Final</h4>
                        <div className="bg-stone-900/50 p-4 rounded-lg border border-stone-700 space-y-2 max-h-96 overflow-y-auto">
                           {startingGold > 0 && (
                               <div className="text-amber-400 font-semibold text-lg mb-2">
                                    Ouro Inicial: {startingGold} gp
                               </div>
                           )}
                            {[...fixedEquipment, ...finalizedEquipment].length > 0 ? (
                                [...fixedEquipment, ...finalizedEquipment].map((item, index) => {
                                    const translatedItem = translateEquipment(item);
                                    return (
                                        <div key={item.id || index} className="text-sm text-stone-300 bg-stone-800/50 p-3 rounded-md border border-stone-700/50">
                                            <p className="font-bold text-stone-200">{translatedItem.name} {translatedItem.quantity > 1 ? `(x${translatedItem.quantity})` : ''}</p>
                                            {translatedItem.damage && (
                                                <p className="text-xs text-amber-300 font-mono">{translatedItem.damage.damage_dice} {translatedItem.damage.damage_type.name}</p>
                                            )}
                                            {translatedItem.desc && translatedItem.desc.length > 0 && (
                                                <p className="text-xs text-stone-400 italic mt-1">{translatedItem.desc[0]}</p>
                                            )}
                                        </div>
                                    )
                                })
                            ) : (
                                <p className="text-stone-500 italic text-center py-4">Seu inventário está vazio.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Navegação */}
            <div className="flex justify-between pt-8">
                <button type="button" onClick={prevStep} className="menu-button btn-import max-w-xs">
                    <Icons.Play className="h-6 w-6 mr-3 transform rotate-90 scale-y-150" />
                    Voltar
                </button>
                <button
                    type="button"
                    onClick={nextStep}
                    disabled={!areAllEquipmentChoicesMade || isEquipmentLoading}
                    className="menu-button btn-new max-w-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {areAllEquipmentChoicesMade ? 'Avançar' : 'Faça suas escolhas'}
                    <Icons.Play className="h-6 w-6 ml-3 transform -rotate-90 scale-y-150" />
                </button>
            </div>
        </div>
    );
};

export default NewStep5_Equipment;
