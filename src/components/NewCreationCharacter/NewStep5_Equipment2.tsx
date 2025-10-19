// src/components/NewCreationCharacter/NewStep5_Equipment2.tsx
import React, { useMemo, useState } from 'react';
import type { InventoryItem, ApiEquipmentOption } from '@/types';
import { useCharacterCreator } from '@/hooks/character-creation/useCharacterCreator';
import { getOptionLabel } from '@/utils/creationHelpers';
import { Dice5, Loader2, ArrowLeft, ArrowRight, Backpack } from 'lucide-react';
import ItemCard from '../ItemCard';
import { v4 as uuidv4 } from 'uuid';
import { findCacheMatch, resolveEquipmentCategory } from '@/utils/equipmentCacheBuilder'; // Importar a função centralizada

const ItemChoiceSelector: React.FC<{
    choice: any;
    selectionPath: string;
    subIndex: number;
    hook: ReturnType<typeof useCharacterCreator>;
}> = ({ choice, selectionPath, subIndex, hook }) => {
    const { handleEquipmentSubChoiceChange, equipmentCategoryCache } = hook;
    
    let categoryIndex = '';
    let optionsSource: any[] = [];
    
    if (choice?.from?.equipment_category) {
        const cat = choice.from.equipment_category;
        categoryIndex = typeof cat === 'string' ? cat : cat?.name || cat?.index;
    } else {
        optionsSource = choice?.from?.options || [];
    }
    
    const cacheKey = findCacheMatch(categoryIndex, equipmentCategoryCache);
    const subOptions = cacheKey ? equipmentCategoryCache[cacheKey] : optionsSource.map(opt => opt.item || opt.of);

    const currentMainSelection = hook.equipmentSelections[selectionPath];
    const currentSubSelections = (typeof currentMainSelection === 'object' && currentMainSelection?.sub) ? currentMainSelection.sub : {};
    const thisSubSelection = currentSubSelections[subIndex];

    return (
         <div className="mt-2 pl-4 border-l-2 border-stone-600">
             <label className="text-xs text-stone-400">{choice.desc || `Escolha uma opção`}</label>
             <select
                value={thisSubSelection || ""}
                onChange={(e) => handleEquipmentSubChoiceChange(selectionPath, e.target.value, subIndex)}
                className="w-full bg-stone-900/70 border border-stone-700 rounded-md p-2 text-stone-200 focus:ring-1 focus:ring-amber-500 focus:border-amber-500 text-sm mt-1"
            >
                <option value="" disabled>Selecione uma opção...</option>
                {subOptions.map((item: any, idx: number) => (
                    item && <option key={item.index || idx} value={item.index}>
                        {item.name}
                    </option>
                ))}
            </select>
        </div>
    )
};

const EquipmentOptionRenderer: React.FC<{
    option: ApiEquipmentOption;
    selectionPath: string;
    hook: ReturnType<typeof useCharacterCreator>;
}> = ({ option, selectionPath, hook }) => {
    switch (option.option_type) {
        case 'counted_reference':
            // This is handled by the main selection, nothing to render here.
            return null;

        case 'choice':
             if (option.choice?.choose && option.choice.choose > 1) {
                 return Array.from({length: option.choice.choose}).map((_, i) => (
                     <ItemChoiceSelector key={i} choice={option.choice} selectionPath={selectionPath} subIndex={i} hook={hook} />
                 ));
            }
            return <ItemChoiceSelector choice={option.choice} selectionPath={selectionPath} subIndex={0} hook={hook} />;

        case 'multiple':
            return (
                <div className="space-y-3 pt-3 mt-3 border-t border-stone-700/50">
                    {option.items?.map((subItem, subIndex) => {
                        // Itens fixos dentro de uma opção múltipla são apenas informativos aqui, pois já são adicionados ao inventário
                        if (subItem.option_type === 'counted_reference' && subItem.of) {
                            return (
                                <p key={subIndex} className="text-sm text-stone-300 pl-4">+ {subItem.count || 1}x {subItem.of.name}</p>
                            )
                        } else if (subItem.option_type === 'choice') {
                           return <ItemChoiceSelector key={subIndex} choice={subItem.choice} selectionPath={selectionPath} subIndex={subIndex} hook={hook} />
                        }
                        return null;
                    })}
                </div>
            );
        default:
            return <p className="text-red-500 text-xs">Opção de equipamento não suportada: {option.option_type}</p>;
    }
};

const EquipmentChoice: React.FC<{
    group: any;
    hook: ReturnType<typeof useCharacterCreator>;
}> = ({ group, hook }) => {
    const { equipmentSelections, handleEquipmentChoiceChange, equipmentCategoryCache } = hook;
    const selection = equipmentSelections[group.id];
    const [lazyItems, setLazyItems] = useState<InventoryItem[] | null>(null);
    const [lazyLoading, setLazyLoading] = useState(false);

    let mainOptions: ApiEquipmentOption[] = [];

    if (group.choice?.from?.option_set_type === 'options_array') {
        mainOptions = group.choice.from.options || [];
    } else if (group.choice?.from?.option_set_type === 'equipment_category') {
        const cat = group.choice.from.equipment_category;
        const categoryKey = typeof cat === 'string' ? cat : cat?.name || cat?.index;
        const cacheKey = findCacheMatch(categoryKey, equipmentCategoryCache);
        
        const source = cacheKey ? equipmentCategoryCache[cacheKey] : lazyItems;

        if (source?.length) {
            mainOptions = source.map(item => ({
                option_type: 'counted_reference',
                count: 1,
                of: { index: item.index, name: item.name, url: item.url || `/api/2014/equipment/${item.index}` },
            }));
        } else if (!lazyItems && !lazyLoading && categoryKey) {
            setLazyLoading(true);
            resolveEquipmentCategory(categoryKey, equipmentCategoryCache)
                .then((items) => setLazyItems(items))
                .finally(() => setLazyLoading(false));
        }
    }
    
    if (lazyLoading) {
        return <p className="text-stone-400 text-xs italic">Carregando opções de {group.choice?.from?.equipment_category?.name || 'categoria'}…</p>;
    }

    if (!mainOptions.length) {
         if (process.env.NODE_ENV === 'development') {
            const categoryKey = group.choice?.from?.equipment_category?.name || group.choice?.from?.equipment_category?.index || 'undefined';
            console.error(`[EquipmentChoice] Nenhum item encontrado para a categoria: '${categoryKey}'. Verifique o cache.`);
            console.log(`[EquipmentChoice] Desc: "${group.choice.desc}", CatKey: "${categoryKey}", CacheKey: "${findCacheMatch(categoryKey, equipmentCategoryCache)}"`);
            console.log(`[EquipmentChoice] Cache dump:`, equipmentCategoryCache);
         }
        return <p className="text-red-400 text-xs">Nenhuma opção encontrada para a categoria '{group.choice?.from?.equipment_category?.name}'.</p>;
    }
    
    const mainSelectionIndex = selection?.main;
    const selectedOption = (mainSelectionIndex !== undefined && mainSelectionIndex >= 0) ? mainOptions[mainSelectionIndex] : undefined;

    return (
        <div className="bg-stone-800/60 p-4 rounded-lg border border-stone-700 space-y-3">
            <h5 className="font-semibold text-stone-300">{group.choice.desc}</h5>
            <select
                value={mainSelectionIndex ?? -1}
                onChange={(e) => handleEquipmentChoiceChange(group.id, parseInt(e.target.value, 10))}
                className="w-full bg-stone-900/70 border border-stone-700 rounded-md p-3 text-stone-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
                <option value={-1} disabled>Selecione uma opção...</option>
                {mainOptions.map((opt: any, index: number) => <option key={index} value={index}>{getOptionLabel(opt)}</option>)}
            </select>
            
            {selectedOption && <EquipmentOptionRenderer option={selectedOption} selectionPath={group.id} hook={hook} />}
        </div>
    );
};


const NewStep5_Equipment2: React.FC<{
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

    const classChoices = equipmentChoiceGroups.filter(g => g.source === 'Classe');
    const backgroundChoices = equipmentChoiceGroups.filter(g => g.source === 'Antecedente');

    const allInventory = useMemo(() => {
        const consolidated = new Map<string, InventoryItem>();
        const items = [...fixedEquipment, ...finalizedEquipment];

        for (const item of items) {
            if (item && item.index) {
                if (consolidated.has(item.index)) {
                    const existing = consolidated.get(item.index)!;
                    existing.quantity += item.quantity || 1;
                } else {
                    consolidated.set(item.index, { ...item, quantity: item.quantity || 1, id: item.id || uuidv4() });
                }
            }
        }
        return Array.from(consolidated.values());

    }, [fixedEquipment, finalizedEquipment]);

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
            <p className="text-sm text-stone-400 -mt-6">Sua classe e antecedente fornecem seu equipamento inicial. Faça suas escolhas abaixo.</p>

            {loadingStates.isLoading ? (
                <div className="flex flex-col items-center justify-center p-8 text-stone-400">
                    <Loader2 className="h-12 w-12 animate-spin" />
                    <p className="mt-4">{loadingStates.message || 'Carregando opções...'}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-8">
                        {backgroundChoices.length > 0 && (
                            <div>
                                <h4 className="font-semibold text-amber-300 mb-3 border-b border-stone-700 pb-2">Equipamentos do Antecedente</h4>
                                <div className="space-y-4">
                                {backgroundChoices.map((group) => (
                                    <EquipmentChoice key={group.id} group={group} hook={hook} />
                                ))}
                                </div>
                            </div>
                        )}
                        {classChoices.length > 0 && (
                             <div>
                                <h4 className="font-semibold text-amber-300 mb-3 border-b border-stone-700 pb-2">Equipamentos da Classe</h4>
                                <div className="space-y-4">
                                {classChoices.map((group) => (
                                    <EquipmentChoice key={group.id} group={group} hook={hook} />
                                ))}
                                </div>
                            </div>
                        )}
                         {equipmentChoiceGroups.length === 0 && (
                            <p className="text-stone-400 italic">Nenhuma escolha de equipamento necessária.</p>
                        )}
                    </div>
                    
                    <div className="space-y-4">
                        <h4 className="font-semibold text-amber-300 mb-3 border-b border-stone-700 pb-2 flex items-center gap-2">
                           <Backpack /> Inventário Resultante
                        </h4>
                        <div className="bg-stone-900/50 p-4 rounded-lg border border-stone-700 space-y-2 max-h-[60vh] overflow-y-auto">
                           {allInventory.length === 0 ? (
                                <p className="text-stone-500 italic text-center py-4">Seu inventário está vazio.</p>
                            ) : (
                                allInventory.map((item, index) => (
                                    <ItemCard key={`item-${item.index}-${index}`} item={item} proficiencies={finalProficiencies} defaultExpanded={false}/>
                                ))
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

export default NewStep5_Equipment2;
