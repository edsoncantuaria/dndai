// src/components/NewCreationCharacter/NewStep5_Equipment2.tsx
import React, { useMemo, useState } from 'react';
import type { InventoryItem, ApiEquipmentOption } from '@/types';
import { useCharacterCreator } from '@/hooks/character-creation/useCharacterCreator';
import { getOptionLabel } from '@/utils/creationHelpers';
import { Dice5, Loader2, ArrowLeft, ArrowRight, Backpack } from 'lucide-react';
import ItemCard from '../ItemCard';
import { v4 as uuidv4 } from 'uuid';
import { findCacheMatch, resolveEquipmentCategory, normalizeKey } from '@/utils/equipmentCacheBuilder';
import { translateEquipment } from '@/utils/translator'; // Importar a função de tradução

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
    if (process.env.NODE_ENV === 'development' && categoryIndex && !cacheKey) {
        console.warn(`[ItemChoiceSelector] Cache MISS para categoria: "${categoryIndex}" (normalizado: "${normalizeKey(categoryIndex)}")`);
    }

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
            return null; // Already handled by the main selection

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

    const categoryFrom = group.choice?.from?.equipment_category;

    if (group.choice?.from?.option_set_type === 'options_array') {
        mainOptions = group.choice.from.options || [];
    } else if (categoryFrom) {
        const categoryKey = typeof categoryFrom === 'string' ? categoryFrom : categoryFrom.name || categoryFrom.index;
        const cacheKey = findCacheMatch(categoryKey, equipmentCategoryCache);
        const source = cacheKey ? equipmentCategoryCache[cacheKey] : lazyItems;

        if (source?.length) {
            mainOptions = source.map(item => ({
                option_type: 'counted_reference',
                count: 1,
                of: { index: item.index, name: item.name, url: (item as any).url || `/api/data/equipment/${item.index}` },
            }));
        } else if (!lazyItems && !lazyLoading && categoryKey) {
            setLazyLoading(true);
            resolveEquipmentCategory(categoryKey, equipmentCategoryCache)
                .then((items) => setLazyItems(items))
                .finally(() => setLazyLoading(false));
        }
    }
    
    if (lazyLoading) {
        return (
            <div className="flex items-center justify-center rounded-3xl border border-white/5 bg-stone-950/60 p-4 text-stone-400">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                <span>Carregando {group.choice?.from?.equipment_category?.name || 'itens'}...</span>
            </div>
        );
    }
    
    const mainSelectionIndex = selection?.main;
    const selectedOption = (mainSelectionIndex !== undefined && mainSelectionIndex >= 0) ? mainOptions[mainSelectionIndex] : undefined;

    return (
        <div className="rounded-3xl border border-white/5 bg-stone-950/60 p-5 space-y-4 shadow-inner shadow-black/20">
            <div className="flex items-center justify-between gap-2">
                <h5 className="text-sm font-semibold text-stone-100">{group.choice.desc}</h5>
                <span className="text-xs text-stone-500">{group.source}</span>
            </div>
            <select
                value={mainSelectionIndex ?? -1}
                onChange={e => handleEquipmentChoiceChange(group.id, parseInt(e.target.value, 10))}
                className="w-full rounded-2xl border border-white/10 bg-stone-950/70 p-3 text-sm text-stone-100 focus:border-amber-400 focus:outline-none"
            >
                <option value={-1} disabled>
                    Selecione uma opção...
                </option>
                {mainOptions.map((opt: any, index: number) => (
                    <option key={index} value={index}>
                        {getOptionLabel(opt)}
                    </option>
                ))}
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
                const translatedItem = translateEquipment(item);
                if (translatedItem.index.startsWith('pouch-with-')) {
                    continue;
                }
                if (consolidated.has(translatedItem.index)) {
                    const existing = consolidated.get(translatedItem.index)!;
                    existing.quantity += translatedItem.quantity || 1;
                } else {
                    consolidated.set(translatedItem.index, { ...translatedItem, quantity: translatedItem.quantity || 1, id: (translatedItem as any).id || uuidv4() });
                }
            }
        }
        return Array.from(consolidated.values());

    }, [fixedEquipment, finalizedEquipment]);

    return (
        <div className="space-y-10 animate-fadeIn">
            <section className="rounded-[32px] border border-white/5 bg-stone-950/70 p-6 shadow-2xl shadow-black/40">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
                    <div>
                        <p className="text-xs uppercase tracking-[0.5em] text-amber-400/80">Arsenal Inicial</p>
                        <h3 className="text-3xl font-semibold text-amber-50">Monte seu equipamento</h3>
                        <p className="text-sm text-stone-400">
                            Combine as opções de classe e antecedente para definir armas, armaduras e utilidades que acompanharão sua jornada.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleRandomizeEquipment}
                        className="flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-300 hover:bg-amber-500/20"
                    >
                        <Dice5 className="h-4 w-4" />
                        Sortear combinações
                    </button>
                </div>

                {loadingStates.isLoading ? (
                    <div className="flex flex-col items-center justify-center p-12 text-stone-400">
                        <Loader2 className="h-12 w-12 animate-spin" />
                        <p className="mt-4">{loadingStates.message || 'Carregando opções...'}</p>
                    </div>
                ) : (
                    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
                        <div className="space-y-6">
                            {backgroundChoices.length > 0 && (
                                <div className="space-y-4">
                                    <h4 className="text-sm font-semibold uppercase tracking-[0.4em] text-stone-500">Antecedente</h4>
                                    {backgroundChoices.map(group => (
                                        <EquipmentChoice key={group.id} group={group} hook={hook} />
                                    ))}
                                </div>
                            )}
                            {classChoices.length > 0 && (
                                <div className="space-y-4">
                                    <h4 className="text-sm font-semibold uppercase tracking-[0.4em] text-stone-500">Classe</h4>
                                    {classChoices.map(group => (
                                        <EquipmentChoice key={group.id} group={group} hook={hook} />
                                    ))}
                                </div>
                            )}
                            {equipmentChoiceGroups.length === 0 && (
                                <p className="text-sm text-stone-500">Nenhuma escolha adicional de equipamento é necessária.</p>
                            )}
                        </div>

                        <div className="space-y-4 rounded-3xl border border-white/5 bg-stone-950/60 p-5">
                            <div className="flex items-center gap-2">
                                <Backpack className="h-5 w-5 text-amber-300" />
                                <div>
                                    <p className="text-xs uppercase tracking-[0.4em] text-stone-500">Inventário resultante</p>
                                    <h4 className="text-lg font-semibold text-stone-100">Prévia completa</h4>
                                </div>
                            </div>
                            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-2">
                                {allInventory.length === 0 ? (
                                    <p className="py-8 text-center text-sm text-stone-500">Seu inventário está vazio.</p>
                                ) : (
                                    allInventory.map((item, index) => (
                                        <ItemCard
                                            key={`item-${item.index}-${index}`}
                                            item={item}
                                            proficiencies={finalProficiencies}
                                            defaultExpanded={false}
                                        />
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </section>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                    type="button"
                    onClick={prevStep}
                    className="flex items-center justify-center gap-2 rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-stone-100 transition hover:border-white/40 hover:bg-white/5"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar para Proficiências
                </button>
                <button
                    type="button"
                    onClick={nextStep}
                    disabled={!areAllEquipmentChoicesMade || loadingStates.isLoading}
                    className="flex items-center justify-center gap-3 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500/80 to-rose-500/70 px-6 py-3 text-base font-semibold text-stone-950 shadow-lg shadow-amber-500/30 transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {areAllEquipmentChoicesMade ? 'Prosseguir para Magias' : 'Conclua as escolhas pendentes'}
                    <ArrowRight className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
};

export default NewStep5_Equipment2;
