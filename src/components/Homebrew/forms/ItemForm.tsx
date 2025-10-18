// src/components/Homebrew/forms/ItemForm.tsx
'use client';
import React, { useState, useEffect } from 'react';
import * as DndApiService from '@/services/dndApiService';
import { Loader2 } from 'lucide-react';
import type { ApiListItem } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
    onDataChange: (data: any) => void;
    initialData?: any;
}

const RARITIES = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact"];

const defaultItemData = {
    name: '',
    desc: [''],
    equipment_category: { index: 'adventuring-gear', name: 'Adventuring Gear' },
    cost: { quantity: 0, unit: 'gp' },
    weight: 0,
    rarity: { name: 'Common' },
    isMagic: false,
    official_index: '',
};

const ItemForm: React.FC<Props> = ({ onDataChange, initialData }) => {
    const { user } = useAuth();
    const [itemData, setItemData] = useState({
        ...defaultItemData,
        ...(initialData || {}),
        desc: initialData?.desc || [''],
    });
    const [equipmentCategories, setEquipmentCategories] = useState<ApiListItem[]>([]);
    const [isLoadingCategories, setIsLoadingCategories] = useState(true);

    useEffect(() => {
        if(initialData) {
            setItemData({
                ...defaultItemData,
                ...initialData,
                isMagic: !!initialData.rarity,
                desc: initialData.desc || [''],
            });
        }
    }, [initialData]);

    useEffect(() => {
        const fetchCategories = async () => {
            setIsLoadingCategories(true);
            try {
                const cats = await DndApiService.getEquipmentCategories();
                if (cats?.results) {
                    setEquipmentCategories(cats.results);
                    if (!itemData.equipment_category.index && cats.results.length > 0) {
                        handleFieldChange('equipment_category', {
                            index: cats.results[0].index,
                            name: cats.results[0].name
                        });
                    }
                }
            } catch (error) {
                console.error("Failed to fetch equipment categories", error);
            } finally {
                setIsLoadingCategories(false);
            }
        };
        fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const fullData = {
            ...itemData,
            index: itemData.official_index || (itemData.name || '').toLowerCase().replace(/\s+/g, '-') || `custom-item-${Date.now()}`
        };
        const { isMagic, official_index, ...finalData } = fullData;
        if (!isMagic) {
            delete finalData.rarity;
        }
        onDataChange(finalData);
    }, [itemData, onDataChange]);


    const handleFieldChange = (field: keyof typeof itemData, value: any) => {
        setItemData(prev => ({...prev, [field]: value}));
    };

    const handleCategoryChange = (index: string) => {
        const category = equipmentCategories.find(cat => cat.index === index);
        if (category) {
            handleFieldChange('equipment_category', { index: category.index, name: category.name });
        }
    };
    
    const handleCostChange = (field: 'quantity' | 'unit', value: string | number) => {
        const newCost = { ...itemData.cost, [field]: value };
        handleFieldChange('cost', newCost);
    }
    
    const handleRarityChange = (name: string) => {
        handleFieldChange('rarity', { name });
    }

    return (
        <div className="space-y-4">
            <div>
                <label htmlFor="item-name" className="block text-sm font-medium text-stone-300 mb-1">Nome do Item</label>
                <input id="item-name" type="text" value={itemData.name} onChange={e => handleFieldChange('name', e.target.value)} required className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" />
            </div>
            {user?.id === 1 && (
                <div>
                    <label htmlFor="official_index" className="block text-sm font-medium text-stone-300 mb-1">Índice Oficial (para Sobrescrever/Traduzir)</label>
                    <input id="official_index" type="text" value={itemData.official_index} onChange={e => handleFieldChange('official_index', e.target.value)} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" placeholder="Ex: longsword (opcional)"/>
                </div>
            )}
             <div>
                 <label className="block text-sm font-medium text-stone-300 mb-1">Descrição</label>
                 <textarea value={itemData.desc[0]} onChange={e => handleFieldChange('desc', [e.target.value])} required rows={4} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" placeholder="Descreva a aparência e os efeitos do item."/>
            </div>
             <div className="flex items-center gap-4">
                 <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={itemData.isMagic} onChange={(e) => handleFieldChange('isMagic', e.target.checked)} className="form-checkbox text-amber-500 bg-stone-700 border-stone-600 rounded" />
                    É um item mágico?
                </label>
             </div>
             {itemData.isMagic && (
                 <div className="animate-fadeIn">
                     <label htmlFor="item-rarity" className="block text-sm font-medium text-stone-300 mb-1">Raridade</label>
                    <select id="item-rarity" value={itemData.rarity.name} onChange={(e) => handleRarityChange(e.target.value)} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200">
                        {RARITIES.map(r => (
                            <option key={r} value={r}>{r}</option>
                        ))}
                    </select>
                </div>
            )}
            <div>
                 <label htmlFor="item-category" className="block text-sm font-medium text-stone-300 mb-1">Categoria do Equipamento</label>
                {isLoadingCategories ? <Loader2 className="animate-spin" /> : (
                    <select id="item-category" value={itemData.equipment_category.index} onChange={(e) => handleCategoryChange(e.target.value)} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200">
                        {equipmentCategories.map(cat => (
                            <option key={cat.index} value={cat.index}>{cat.name}</option>
                        ))}
                    </select>
                )}
            </div>
             <div className="grid grid-cols-2 gap-4">
                <div>
                     <label className="block text-sm font-medium text-stone-300 mb-1">Peso (em lbs)</label>
                    <input type="number" value={itemData.weight} onChange={e => handleFieldChange('weight', Number(e.target.value))} min="0" className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" />
                </div>
                 <div className="flex gap-2">
                     <div className="flex-grow">
                        <label className="block text-sm font-medium text-stone-300 mb-1">Custo</label>
                        <input type="number" value={itemData.cost.quantity} onChange={e => handleCostChange('quantity', Number(e.target.value))} min="0" className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" />
                    </div>
                     <div className="w-24">
                        <label className="block text-sm font-medium text-stone-300 mb-1">Moeda</label>
                         <select value={itemData.cost.unit} onChange={e => handleCostChange('unit', e.target.value)} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200">
                             <option value="cp">CP</option>
                             <option value="sp">SP</option>
                             <option value="gp">GP</option>
                             <option value="pp">PP</option>
                         </select>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ItemForm;
