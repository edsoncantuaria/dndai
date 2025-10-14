// src/components/Homebrew/forms/ItemForm.tsx
'use client';
import React, { useState, useEffect } from 'react';
import * as DndApiService from '@/services/dndApiService';
import { translateApiString } from '@/utils/translator';
import { Loader2 } from 'lucide-react';
import type { ApiListItem } from '@/types';

interface Props {
    onDataChange: (data: any) => void;
}

const ItemForm: React.FC<Props> = ({ onDataChange }) => {
    const [itemData, setItemData] = useState({
        name: '',
        desc: [''],
        equipment_category: { index: 'adventuring-gear', name: 'Adventuring Gear' },
        cost: { quantity: 0, unit: 'gp' },
        weight: 0,
    });
    const [equipmentCategories, setEquipmentCategories] = useState<ApiListItem[]>([]);
    const [isLoadingCategories, setIsLoadingCategories] = useState(true);

    useEffect(() => {
        const fetchCategories = async () => {
            setIsLoadingCategories(true);
            try {
                const cats = await DndApiService.getEquipmentCategories();
                if (cats?.results) {
                    setEquipmentCategories(cats.results);
                    // Set a default category if not already set
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

    const updateParent = (newData: any) => {
        const fullData = {
            ...newData,
            index: newData.name.toLowerCase().replace(/\s+/g, '-') || `custom-item-${Date.now()}`
        };
        onDataChange(fullData);
    };

    const handleFieldChange = (field: keyof typeof itemData, value: any) => {
        const newData = { ...itemData, [field]: value };
        setItemData(newData);
        updateParent(newData);
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

    return (
        <div className="space-y-4">
            <div>
                <label htmlFor="item-name" className="block text-sm font-medium text-stone-300 mb-1">Nome do Item</label>
                <input id="item-name" type="text" value={itemData.name} onChange={e => handleFieldChange('name', e.target.value)} required className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" />
            </div>
             <div>
                <label className="block text-sm font-medium text-stone-300 mb-1">Descrição</label>
                <textarea value={itemData.desc[0]} onChange={e => handleFieldChange('desc', [e.target.value])} required rows={4} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200" placeholder="Descreva a aparência e os efeitos do item."/>
            </div>
            <div>
                 <label htmlFor="item-category" className="block text-sm font-medium text-stone-300 mb-1">Categoria do Equipamento</label>
                {isLoadingCategories ? <Loader2 className="animate-spin" /> : (
                    <select id="item-category" value={itemData.equipment_category.index} onChange={(e) => handleCategoryChange(e.target.value)} className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200">
                        {equipmentCategories.map(cat => (
                            <option key={cat.index} value={cat.index}>{translateApiString(cat.name)}</option>
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
