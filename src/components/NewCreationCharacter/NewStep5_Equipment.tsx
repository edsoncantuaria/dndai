// src/components/NewCreationCharacter/NewStep5_Equipment.tsx
import React from 'react';
import { useNewCharacterCreation } from '@/hooks/newUseCharacterCreation';
import NewSubEquipment from './NewSubEquipment';
import { translateEquipment } from '@/utils/translator';
import { Dice5, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';

interface Props {
    hook: ReturnType<typeof useNewCharacterCreation>;
    prevStep: () => void;
    nextStep: () => void;
}

const NewStep5_Equipment: React.FC<Props> = ({ hook, prevStep, nextStep }) => {
    const { 
        equipmentChoiceGroups,
        fixedEquipment,
        loadingStates,
        areAllEquipmentChoicesMade,
        handleRandomizeEquipment,
    } = hook;

    return (
        <div className="space-y-8 animate-fadeIn">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-stone-300">Equipamento Inicial</h3>
                 <button
                    type="button"
                    onClick={handleRandomizeEquipment}
                    className="flex items-center gap-1.5 text-xs bg-amber-600/20 hover:bg-amber-600/40 text-amber-200 font-semibold py-1 px-2 rounded-md transition-colors"
                >
                    <Dice5 className="h-4 w-4" />
                    Aleatório
                </button>
            </div>
             <p className="text-sm text-stone-400 -mt-6">Sua classe e antecedente fornecem seu equipamento inicial. Escolha suas opções abaixo.</p>

            {loadingStates.class || loadingStates.background ? (
                <div className="flex flex-col items-center justify-center p-8 text-stone-400">
                    <Loader2 className="h-12 w-12 animate-spin" />
                    <p className="mt-4">Carregando opções de equipamento...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                    
                    <div className="space-y-4">
                        <h4 className="font-semibold text-amber-300 mb-3 border-b border-stone-700 pb-2">Inventário Fixo</h4>
                        <div className="bg-stone-900/50 p-4 rounded-lg border border-stone-700 space-y-2 max-h-96 overflow-y-auto">
                           {(fixedEquipment || []).length > 0 ? (
                                (fixedEquipment || []).map((item, index) => {
                                    const translatedItem = translateEquipment(item);
                                    return (
                                        <div key={item.id || index} className="text-sm text-stone-300 bg-stone-800/50 p-2 rounded-md">
                                            <p className="font-bold text-stone-200">{translatedItem.name} {translatedItem.quantity > 1 ? `(x${translatedItem.quantity})` : ''}</p>
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

            <div className="flex justify-between pt-8">
                <button type="button" onClick={prevStep} className="menu-button btn-import max-w-xs">
                    <ArrowLeft className="h-6 w-6 mr-3" />
                    Voltar
                </button>
                <button type="button" onClick={nextStep} disabled={!areAllEquipmentChoicesMade || loadingStates.class} className="menu-button btn-new max-w-xs disabled:opacity-50 disabled:cursor-not-allowed">
                    {areAllEquipmentChoicesMade ? 'Avançar' : 'Faça suas escolhas'}
                    <ArrowRight className="h-6 w-6 ml-3" />
                </button>
            </div>
        </div>
    );
};

export default NewStep5_Equipment;
