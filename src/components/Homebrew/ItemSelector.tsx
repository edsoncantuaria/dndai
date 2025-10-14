// src/components/Homebrew/ItemSelector.tsx
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import * as DndApiService from '@/services/dndApiService';
import * as HomebrewService from '@/services/homebrewService';
import { ApiListItem } from '@/types';
import { Loader2, Plus } from 'lucide-react';
import { translateApiString } from '@/utils/translator';
import ItemCreator from './ItemCreator';

interface Props {
    selectedItem: string;
    onItemSelect: (itemName: string) => void;
}

const ItemSelector: React.FC<Props> = ({ selectedItem, onItemSelect }) => {
    const [allItems, setAllItems] = useState<ApiListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreatorOpen, setIsCreatorOpen] = useState(false);

    const fetchItems = useCallback(async () => {
        setIsLoading(true);
        try {
            const officialItemsPromise = DndApiService.getEquipment();
            const publicHomebrewPromise = HomebrewService.listHomebrewContent('public', 'item');
            const myHomebrewPromise = HomebrewService.listHomebrewContent('mine', 'item');

            const [officialResult, publicHomebrewResult, myHomebrewResult] = await Promise.all([
                officialItemsPromise,
                publicHomebrewPromise,
                myHomebrewPromise,
            ]);

            const official = officialResult?.results || [];
            
            const formatHomebrew = (items: HomebrewService.HomebrewContent[]) => items.map(hb => ({
                index: hb.id,
                name: `(H) ${hb.name}`,
                url: `/api/homebrew/${hb.id}`,
            }));

            const publicHomebrew = formatHomebrew(publicHomebrewResult);
            const myHomebrew = formatHomebrew(myHomebrewResult);

            const combinedHomebrew = [...myHomebrew, ...publicHomebrew.filter(phb => !myHomebrew.some(mhb => mhb.index === phb.index))];

            setAllItems([...official, ...combinedHomebrew].sort((a, b) => a.name.localeCompare(b.name)));
        } catch (error) {
            console.error("Failed to fetch items:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchItems();
    }, [fetchItems]);
    
    const handleItemCreated = (newItemContent: any) => {
        const newApiListItem: ApiListItem = {
            index: newItemContent.index,
            name: `(H) ${newItemContent.name}`,
            url: `/api/homebrew/${newItemContent.index}`,
        };
        setAllItems(prev => [newApiListItem, ...prev].sort((a, b) => a.name.localeCompare(b.name)));
        onItemSelect(newApiListItem.name);
    };

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-stone-300">Componente Material</label>
            <div className="flex items-center gap-2">
                <select 
                    value={selectedItem}
                    onChange={(e) => onItemSelect(e.target.value)}
                    className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-stone-200"
                >
                    {isLoading ? (
                        <option>Carregando itens...</option>
                    ) : (
                        <>
                            <option value="">Nenhum</option>
                            {allItems.map(item => (
                                <option key={item.index} value={item.name}>{translateApiString(item.name)}</option>
                            ))}
                        </>
                    )}
                </select>
                <button type="button" className="p-2 bg-amber-700 hover:bg-amber-600 rounded-md" onClick={() => setIsCreatorOpen(true)} title="Criar Novo Item">
                    <Plus className="h-5 w-5 text-white"/>
                </button>
            </div>
            <ItemCreator 
                isOpen={isCreatorOpen}
                onClose={() => setIsCreatorOpen(false)}
                onItemCreated={handleItemCreated}
            />
        </div>
    );
};

export default ItemSelector;
