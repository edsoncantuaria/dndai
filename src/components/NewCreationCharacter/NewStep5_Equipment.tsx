// src/components/NewCreationCharacter/NewStep5_Equipment.tsx
import React from 'react';
import { useCharacterCreator, EquipmentChoiceGroup } from '@/hooks/character-creation/useCharacterCreator';
import { translateApiString } from '@/utils/translator';
import { getOptionLabel } from '@/utils/creationHelpers';
import { Dice5, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import type { InventoryItem } from '@/types';

interface SubChoiceSelectorProps {
    group: EquipmentChoiceGroup;
    mainSelectionIndex: number;
    hook: ReturnType<typeof useCharacterCreator>;
}

const SubChoiceSelector: React.FC<SubChoiceSelectorProps> = ({ group, mainSelectionIndex, hook }) => {
    const { equipmentSelections, setField, allEquipment } = hook;
    const subSelectionIndex = equipmentSelections[group.id]?.sub;
    const mainOption = group.choice.from.options[mainSelectionIndex];

    if (mainOption?.option_type !== 'choice' || !mainOption.choice?.from?.equipment_category?.index) {
        return null;
    }

    const categoryIndex = mainOption.choice.from.equipment_category.index;
    
    // Lógica de filtragem aprimorada
    const subOptions = (allEquipment || []).filter(item => {
        if (!item) return false;

        // Caso 1: Categoria de equipamento direta
        if (item.equipment_category && item.equipment_category.index === categoryIndex) {
            return true;
        }

        // Caso 2: Categorias de armas mais complexas
        const isMartialMelee = categoryIndex === 'martial-melee-weapons' && item.weapon_category === 'Martial' && item.weapon_range === 'Melee';
        const isSimpleWeapon = categoryIndex === 'simple-weapons' && item.weapon_category === 'Simple';
        if (isMartialMelee || isSimpleWeapon) {
            return true;
        }

        // Caso 3: Categorias baseadas em gear_category (Focos Arcanos, Símbolos Sagrados, etc.)
        if (item.gear_category && item.gear_category.index === categoryIndex) {
            return true;
        }

        return false;
    });


    const handleSubSelection = (subIndexStr: string) => {
        const subIdx = parseInt(subIndexStr, 10);
        setField('equipmentSelections', (prev: any) => ({
            ...prev,
            [group.id]: { main: mainSelectionIndex, sub: subIdx },
        }));
    };

    if (hook.loadingStates.equipment) {
        return <Loader2 className="animate-spin text-stone-400 mt-2" />;
    }

    return (
        <select 
            value={subSelectionIndex ?? -1} 
            onChange={(e) => handleSubSelection(e.target.value)} 
            className="w-full bg-stone-900/70 border border-stone-700 rounded-md p-3 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 animate-fadeIn mt-2"
        >
            <option value={-1} disabled>Selecione um item...</option>
            {subOptions.map((item, index) => <option key={item.index} value={index}>{translateApiString(item.name)}</option>)}
        </select>
    );
};

interface EquipmentChoiceProps {
    group: EquipmentChoiceGroup;
    hook: ReturnType<typeof useCharacterCreator>;
}

const EquipmentChoice: React.FC<EquipmentChoiceProps> = ({ group, hook }) => {
    const { equipmentSelections, setField } = hook;
    const mainSelectionIndex = equipmentSelections[group.id]?.main;
    const mainOptions = group.choice.from.options || [];

    const handleMainSelection = (indexStr: string) => {
        const mainIdx = parseInt(indexStr, 10);
        setField('equipmentSelections', (prev: any) => ({
            ...prev,
            [group.id]: { main: mainIdx, sub: undefined },
        }));
    };

    return (
        <div className="bg-stone-800/60 p-4 rounded-lg border border-stone-700 space-y-3">
            <h5 className="font-semibold text-stone-300">{group.choice.desc || `Escolha de ${group.source}`}</h5>
            <select 
                value={mainSelectionIndex ?? -1} 
                onChange={(e) => handleMainSelection(e.target.value)} 
                className="w-full bg-stone-900/70 border border-stone-700 rounded-md p-3 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
                <option value={-1} disabled>Selecione uma opção...</option>
                {mainOptions.map((opt, index) => <option key={index} value={index}>{getOptionLabel(opt)}</option>)}
            </select>
            {mainSelectionIndex !== undefined && (
                <SubChoiceSelector group={group} mainSelectionIndex={mainSelectionIndex} hook={hook} />
            )}
        </div>
    );
};

const NewStep5_Equipment: React.FC<{
    hook: ReturnType<typeof useCharacterCreator>;
    prevStep: () => void;
    nextStep: () => void;
}> = ({ hook, prevStep, nextStep }) => {
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

            {loadingStates.class || loadingStates.background || loadingStates.equipment ? (
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
                                <EquipmentChoice key={group.id} group={group} hook={hook} />
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
                                    return (
                                        <div key={item.id || index} className="text-sm text-stone-300 bg-stone-800/50 p-2 rounded-md">
                                            <p className="font-bold text-stone-200">{item.name} {item.quantity > 1 ? `(x${item.quantity})` : ''}</p>
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
