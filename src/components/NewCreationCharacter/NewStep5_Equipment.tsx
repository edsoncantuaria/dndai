// src/components/NewCreationCharacter/NewStep5_Equipment.tsx
import React from 'react';
import { useCharacterCreator, EquipmentChoiceGroup } from '@/hooks/character-creation/useCharacterCreator';
import { translateApiString } from '@/utils/translator';
import { getOptionLabel } from '@/utils/creationHelpers';
import { Dice5, Loader2, ArrowLeft, ArrowRight, Backpack } from 'lucide-react';
import type { InventoryItem, ApiEquipmentOption } from '@/types';
import ItemCard from '../ItemCard';

// Componente para um seletor de item dentro de uma escolha
const ItemChoiceSelector: React.FC<{
    choice: ApiEquipmentOption['choice'];
    selectionPath: string;
    hook: ReturnType<typeof useCharacterCreator>;
}> = ({ choice, selectionPath, hook }) => {
    const { equipmentSelections, handleEquipmentSubChoiceChange, allEquipment, loadingStates, fetchEquipmentCategory } = hook;

    if (!choice?.from?.equipment_category) {
        return <p className="text-red-400 text-xs">Erro: Categoria de equipamento não definida.</p>;
    }

    const categoryIndex = choice.from.equipment_category.index;
    const choiceCount = choice.choose || 1;
    const [subOptions, setSubOptions] = React.useState<InventoryItem[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);

    React.useEffect(() => {
        const loadOptions = async () => {
            setIsLoading(true);
            const items = await fetchEquipmentCategory(categoryIndex);
            setSubOptions(items);
            setIsLoading(false);
        };
        loadOptions();
    }, [categoryIndex, fetchEquipmentCategory]);

    const currentSelections = equipmentSelections[selectionPath] || [];

    if (isLoading) return <Loader2 className="animate-spin text-stone-400 mt-2" />;
    
    if (subOptions.length === 0) {
        return <p className="text-stone-500 text-sm italic mt-2">Nenhuma opção disponível para "{translateApiString(choice.from.equipment_category.name)}".</p>
    }
    
    return (
        <div className="mt-2 space-y-2">
            <label className="text-xs text-stone-400">{choice.desc || `Escolha ${choiceCount} de ${categoryIndex}`}</label>
             {Array.from({ length: choiceCount }).map((_, i) => (
                <select
                    key={i}
                    value={currentSelections[i] || ""}
                    onChange={(e) => handleEquipmentSubChoiceChange(selectionPath, e.target.value, i)}
                    className="w-full bg-stone-900/70 border border-stone-700 rounded-md p-2 text-stone-200 focus:ring-1 focus:ring-amber-500 focus:border-amber-500 text-sm"
                >
                    <option value="" disabled>Selecione a opção {i + 1}...</option>
                    {subOptions.map((item) => {
                        const isSelectedByOther = Array.isArray(currentSelections) && currentSelections.includes(item.index) && currentSelections[i] !== item.index;
                        return (
                            <option 
                                key={item.index} 
                                value={item.index}
                                disabled={isSelectedByOther}
                            >
                                {translateApiString(item.name)}
                            </option>
                        );
                    })}
                </select>
            ))}
        </div>
    );
};

const EquipmentOptionRenderer: React.FC<{
    option: ApiEquipmentOption;
    selectionPath: string;
    hook: ReturnType<typeof useCharacterCreator>;
}> = ({ option, selectionPath, hook }) => {
    switch (option.option_type) {
        case 'counted_reference':
            return null; // Itens fixos já são tratados no `fixedEquipment`

        case 'choice':
            // Este é um seletor de item aninhado.
            return <ItemChoiceSelector choice={option.choice} selectionPath={selectionPath} hook={hook} />;

        case 'multiple':
             // Esta opção contém vários sub-itens que podem ser fixos ou novas escolhas.
            return (
                <div className="space-y-3 pt-3 mt-3 border-t border-stone-700/50">
                    {option.items?.map((subItem, subIndex) => {
                        // Construímos um caminho aninhado para o estado da seleção
                        const nestedPath = `${selectionPath}.${subIndex}`;
                        return (
                            <EquipmentOptionRenderer
                                key={subIndex}
                                option={subItem}
                                selectionPath={nestedPath}
                                hook={hook}
                            />
                        );
                    })}
                </div>
            );
        default:
            return <p className="text-red-500 text-xs">Opção de equipamento não suportada: {option.option_type}</p>;
    }
};



const EquipmentChoice: React.FC<{
    group: EquipmentChoiceGroup;
    hook: ReturnType<typeof useCharacterCreator>;
}> = ({ group, hook }) => {
    const { equipmentSelections, handleEquipmentChoiceChange } = hook;
    const selection = equipmentSelections[group.id];
    const mainOptions = group.choice.from.options || [];

    if (mainOptions.length === 0) return null;
    
    // A seleção principal agora pode ser um objeto para escolhas aninhadas
    const mainSelectionIndex = typeof selection === 'object' ? selection.main : selection;
    const selectedOption = mainOptions[mainSelectionIndex];
    
    return (
        <div className="bg-stone-800/60 p-4 rounded-lg border border-stone-700 space-y-3">
            <h5 className="font-semibold text-stone-300">{group.choice.desc || `Escolha de ${group.source}`}</h5>
            <select
                value={mainSelectionIndex ?? -1}
                onChange={(e) => handleEquipmentChoiceChange(group.id, parseInt(e.target.value, 10))}
                className="w-full bg-stone-900/70 border border-stone-700 rounded-md p-3 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
                <option value={-1} disabled>Selecione uma opção...</option>
                {mainOptions.map((opt, index) => <option key={index} value={index}>{getOptionLabel(opt)}</option>)}
            </select>
            
            {/* Renderizador recursivo para sub-opções */}
            {selectedOption && (
                <div className="pl-4 border-l-2 border-amber-800/50">
                    <EquipmentOptionRenderer
                        option={selectedOption}
                        selectionPath={group.id}
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

            {loadingStates.isLoading && !loadingStates.message.includes("Carregando Itens") ? (
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
                                        <ItemCard key={`fixed-${item.index}-${index}`} item={item} proficiencies={finalProficiencies} defaultExpanded={false}/>
                                    ))}
                                    {finalizedEquipment.map((item, index) => (
                                         <ItemCard key={`chosen-${item.index}-${index}`} item={item} proficiencies={finalProficiencies} defaultExpanded={false}/>
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
