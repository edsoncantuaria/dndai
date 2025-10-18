// src/components/NewCreationCharacter/NewStep5_Equipment.tsx
import React from 'react';
import { useCharacterCreator, EquipmentChoiceGroup } from '@/hooks/character-creation/useCharacterCreator';
import { translateApiString } from '@/utils/translator';
import { getOptionLabel } from '@/utils/creationHelpers';
import { Dice5, Loader2, ArrowLeft, ArrowRight, Backpack } from 'lucide-react';
import type { InventoryItem, ApiEquipmentOption } from '@/types';
import ItemCard from '../ItemCard';

// Componente para renderizar uma única opção de equipamento, que pode ser simples, múltipla ou uma escolha.
const EquipmentOptionRenderer: React.FC<{
    option: ApiEquipmentOption;
    selectionPath: (string | number)[];
    hook: ReturnType<typeof useCharacterCreator>;
}> = ({ option, selectionPath, hook }) => {
    switch (option.option_type) {
        case 'counted_reference':
            // Este é um item fixo dentro de uma opção múltipla, renderize o nome e a quantidade
            return (
                <div className="text-sm text-stone-300 pl-4 py-1">
                    + {getOptionLabel(option)}
                </div>
            );

        case 'choice':
            return <ItemChoiceSelector choice={option.choice} selectionPath={selectionPath} hook={hook} choiceCount={option.choice.choose || 1}/>;

        case 'multiple':
            return (
                <div className="space-y-3 pt-3 mt-3 border-t border-stone-700/50">
                    {option.items?.map((subItem, subIndex) => (
                        <EquipmentOptionRenderer
                            key={subIndex}
                            option={subItem}
                            selectionPath={[...selectionPath, subIndex]}
                            hook={hook}
                        />
                    ))}
                </div>
            );
        default:
            return <p className="text-red-500 text-xs">Opção de equipamento não suportada: {option.option_type}</p>;
    }
};


// Componente para um seletor de item dentro de uma escolha
const ItemChoiceSelector: React.FC<{
    choice: ApiEquipmentOption['choice'];
    selectionPath: (string | number)[];
    hook: ReturnType<typeof useCharacterCreator>;
    choiceCount: number;
}> = ({ choice, selectionPath, hook, choiceCount = 1 }) => {
    const { equipmentSelections, setField, allEquipment, loadingStates } = hook;

    if (!choice?.from?.equipment_category) {
        return <p className="text-red-400 text-xs">Erro: Categoria de equipamento não definida para esta escolha.</p>;
    }

    const categoryIndex = choice.from.equipment_category.index;

    const subOptions = (allEquipment || []).filter(item => {
        if (!item) return false;
        const itemCategory = item.equipment_category?.index;
        const itemGearCategory = (item as any).gear_category?.index;
        
        return itemCategory === categoryIndex ||
               itemGearCategory === categoryIndex ||
               (categoryIndex === 'martial-weapons' && item.weapon_category === 'Martial') ||
               (categoryIndex === 'simple-weapons' && item.weapon_category === 'Simple') ||
               (categoryIndex === 'martial-melee-weapons' && item.weapon_category === 'Martial' && item.weapon_range === 'Melee') ||
               (categoryIndex === 'simple-melee-weapons' && item.weapon_category === 'Simple' && item.weapon_range === 'Melee') ||
               (categoryIndex === 'arcane-foci' && itemGearCategory === 'arcane-foci') ||
               (categoryIndex === 'druidic-foci' && itemGearCategory === 'druidic-foci') ||
               (categoryIndex === 'holy-symbols' && itemGearCategory === 'holy-symbols');
    });

    const getSelectionValue = (path: (string | number)[]) => {
        let current = equipmentSelections;
        for (const key of path) {
            if (current === undefined || current === null) return -1;
            current = current[key as keyof typeof current];
        }
        return current === undefined ? -1 : current;
    };

    const handleSelection = (path: (string | number)[], itemIndexStr: string) => {
        const itemIdx = parseInt(itemIndexStr, 10);
        setField('equipmentSelections', (prev: any) => {
            let newState = JSON.parse(JSON.stringify(prev)); // Deep copy
            let currentLevel = newState;
            for (let i = 0; i < path.length - 1; i++) {
                const key = path[i];
                if (currentLevel[key] === undefined || typeof currentLevel[key] !== 'object') {
                    currentLevel[key] = Number.isInteger(path[i+1]) ? [] : {};
                }
                currentLevel = currentLevel[key];
            }
            currentLevel[path[path.length - 1]] = itemIdx;
            return newState;
        });
    };

    if (loadingStates.isLoading) return <Loader2 className="animate-spin text-stone-400 mt-2" />;

    return (
        <div className="mt-2 space-y-2">
            <label className="text-xs text-stone-400">{choice.desc || `Escolha ${choiceCount} de ${categoryIndex}`}</label>
             {Array.from({ length: choiceCount }).map((_, i) => {
                const currentPath = [...selectionPath, i];
                const currentSelectionIndex = getSelectionValue(currentPath);
                return (
                    <select
                        key={i}
                        value={currentSelectionIndex ?? -1}
                        onChange={(e) => handleSelection(currentPath, e.target.value)}
                        className="w-full bg-stone-900/70 border border-stone-700 rounded-md p-2 text-stone-200 focus:ring-1 focus:ring-amber-500 focus:border-amber-500 text-sm"
                    >
                        <option value={-1} disabled>Selecione a opção {i + 1}...</option>
                        {subOptions.map((item, index) => <option key={item.index} value={index}>{translateApiString(item.name)}</option>)}
                    </select>
                );
             })}
        </div>
    );
};


const EquipmentChoice: React.FC<{
    group: EquipmentChoiceGroup;
    hook: ReturnType<typeof useCharacterCreator>;
}> = ({ group, hook }) => {
    const { equipmentSelections, setField } = hook;
    const selection = equipmentSelections[group.id];
    const mainOptions = group.choice.from.options || [];

    const handleMainSelection = (indexStr: string) => {
        const mainIdx = parseInt(indexStr, 10);
        setField('equipmentSelections', (prev: any) => ({
            ...prev,
            [group.id]: mainIdx 
        }));
    };
    
    return (
        <div className="bg-stone-800/60 p-4 rounded-lg border border-stone-700 space-y-3">
            <h5 className="font-semibold text-stone-300">{group.choice.desc || `Escolha de ${group.source}`}</h5>
            <select
                value={selection ?? -1}
                onChange={(e) => handleMainSelection(e.target.value)}
                className="w-full bg-stone-900/70 border border-stone-700 rounded-md p-3 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
                <option value={-1} disabled>Selecione uma opção...</option>
                {mainOptions.map((opt, index) => <option key={index} value={index}>{getOptionLabel(opt)}</option>)}
            </select>
            
            {selection !== undefined && selection !== -1 && mainOptions[selection] && mainOptions[selection].option_type === 'multiple' && (
                <div className="pl-4 border-l-2 border-amber-800/50">
                    <EquipmentOptionRenderer 
                        option={mainOptions[selection]}
                        selectionPath={[group.id, 'sub']}
                        hook={hook}
                    />
                </div>
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
        finalizedEquipment,
        loadingStates,
        areAllEquipmentChoicesMade,
        handleRandomizeEquipment,
        finalProficiencies,
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

            {loadingStates.isLoading ? (
                <div className="flex flex-col items-center justify-center p-8 text-stone-400">
                    <Loader2 className="h-12 w-12 animate-spin" />
                    <p className="mt-4">{loadingStates.message || 'Carregando opções...'}</p>
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
                        <h4 className="font-semibold text-amber-300 mb-3 border-b border-stone-700 pb-2 flex items-center gap-2">
                           <Backpack /> Inventário Resultante
                        </h4>
                        <div className="bg-stone-900/50 p-4 rounded-lg border border-stone-700 space-y-2 max-h-[60vh] overflow-y-auto">
                           {(fixedEquipment || []).length === 0 && (finalizedEquipment || []).length === 0 ? (
                                <p className="text-stone-500 italic text-center py-4">Seu inventário está vazio.</p>
                            ) : (
                                <>
                                    {fixedEquipment.map((item, index) => (
                                        <ItemCard key={`fixed-${item.id || index}`} item={item} proficiencies={finalProficiencies} defaultExpanded={false}/>
                                    ))}
                                    {finalizedEquipment.map((item, index) => (
                                         <ItemCard key={`chosen-${item.id || index}`} item={item} proficiencies={finalProficiencies} defaultExpanded={false}/>
                                    ))}
                                </>
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
                <button type="button" onClick={nextStep} disabled={!areAllEquipmentChoicesMade || loadingStates.isLoading} className="menu-button btn-new max-w-xs disabled:opacity-50 disabled:cursor-not-allowed">
                    {areAllEquipmentChoicesMade ? 'Avançar' : 'Faça suas escolhas'}
                    <ArrowRight className="h-6 w-6 ml-3" />
                </button>
            </div>
        </div>
    );
};

export default NewStep5_Equipment;
