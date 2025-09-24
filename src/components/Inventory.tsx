import React, { useMemo, useState } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import ItemCard from './ItemCard';
import type { InventoryItem } from '../types';
import { translateEquipment } from '../utils/TranslatorEquipments';
import { Backpack, ChevronDown } from 'lucide-react';

const CATEGORY_ORDER: Record<string, number> = {
    'Armas': 1,
    'Armaduras': 2,
    'Itens Diversos': 3,
};

const Inventory: React.FC = () => {
    const { character, toggleEquipped } = useGameStateContext();
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
        'Armas': true,
        'Armaduras': true,
        'Itens Diversos': true,
    });

    const groupedInventory = useMemo(() => {
        if (!character) return {};
        
        const groups = character.inventory.reduce((acc, item) => {
            let category = 'Itens Diversos';
            if (item.weapon_category) {
                category = 'Armas';
            } else if (item.armor_category) {
                category = 'Armaduras';
            }
            
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(item);
            return acc;
        }, {} as Record<string, InventoryItem[]>);

        // Sort categories based on predefined order
        return Object.keys(groups)
            .sort((a, b) => (CATEGORY_ORDER[a] || 99) - (CATEGORY_ORDER[b] || 99))
            .reduce((obj, key) => {
                obj[key] = groups[key];
                return obj;
            }, {} as Record<string, InventoryItem[]>);

    }, [character?.inventory]);

    if (!character) return null;

    const toggleCategory = (category: string) => {
        setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
    };

    const { currentWeight, carryingCapacity } = character;
    const loadPercentage = carryingCapacity > 0 ? (currentWeight / carryingCapacity) * 100 : 0;

    let progressBarColor = 'bg-green-600';
    if (loadPercentage > 90) progressBarColor = 'bg-red-600';
    else if (loadPercentage > 75) progressBarColor = 'bg-yellow-500';

    return (
        <div className="p-4 space-y-4">
            <h3 className="text-lg font-bold font-garamond text-amber-300 flex items-center gap-2 mb-3 text-shadow-amber">
                <Backpack />
                Inventário
            </h3>
            
            <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-stone-300">Carga</span>
                    <span className="font-mono text-stone-400">{currentWeight.toFixed(1)} / {carryingCapacity} lbs</span>
                </div>
                <div className="w-full bg-stone-700 rounded-full h-2.5 border border-stone-600 overflow-hidden">
                    <div 
                        className={`${progressBarColor} h-full rounded-full transition-all duration-300`} 
                        style={{ width: `${Math.min(loadPercentage, 100)}%`}}
                    ></div>
                </div>
             </div>

            {Object.keys(groupedInventory).length === 0 ? (
                <p className="text-stone-400 italic">Sua bolsa está vazia.</p>
            ) : (
                <div className="space-y-3">
                    {Object.entries(groupedInventory).map(([category, items]) => {
                        const isExpanded = !!expandedCategories[category];
                        return (
                            <div key={category}>
                                <button 
                                    onClick={() => toggleCategory(category)}
                                    className="w-full flex justify-between items-center p-2 bg-stone-800 hover:bg-stone-700/50 rounded-md transition-colors"
                                    aria-expanded={isExpanded}
                                >
                                    <h4 className="font-semibold text-amber-200">{category} ({items.length})</h4>
                                    <ChevronDown className={`h-5 w-5 text-stone-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                                <div className={`transition-all ease-in-out duration-500 overflow-hidden ${isExpanded ? 'max-h-[1000px] opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                                    <div className="space-y-2 pl-2 border-l-2 border-stone-700 pt-px">
                                        {items.map((item) => (
                                            <ItemCard key={item.id} item={translateEquipment(item)} onToggleEquip={toggleEquipped} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
};

export default Inventory;
