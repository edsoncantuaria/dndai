// src/components/Homebrew/TraitSelector.tsx
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import * as DndApiService from '@/services/dndApiService';
import * as HomebrewService from '@/services/homebrewService';
import { ApiListItem } from '@/types';
import { Loader2, Plus } from 'lucide-react';
import TraitCreator from './TraitCreator'; // Importar o novo componente
import { useAuth } from '@/contexts/AuthContext';
import { hb, hbChipClass, hbTileClass } from '@/features/homebrew/forms/formUi';

interface Props {
    selectedTraits: ApiListItem[];
    onSelectionChange: (traits: ApiListItem[]) => void;
}

const TraitSelector: React.FC<Props> = ({ selectedTraits, onSelectionChange }) => {
    const { user } = useAuth();
    const [allTraits, setAllTraits] = useState<ApiListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreatorOpen, setIsCreatorOpen] = useState(false);

    const fetchTraits = useCallback(async () => {
        setIsLoading(true);
        try {
            const officialTraitsPromise = DndApiService.getTraits();
            const publicHomebrewPromise = HomebrewService.listHomebrewContent('public', 'user', 'feat');
            const myHomebrewPromise = user ? HomebrewService.listHomebrewContent('mine', 'user', 'feat') : Promise.resolve([]);

            const [officialResult, publicHomebrewResult, myHomebrewResult] = await Promise.all([
                officialTraitsPromise,
                publicHomebrewPromise,
                myHomebrewPromise,
            ]);

            const official = officialResult?.results || [];
            
            const formatHomebrew = (items: HomebrewService.HomebrewContent[], source: string) => items.map(hb => ({
                index: hb.id,
                name: `${hb.name} (${source})`,
                url: `/api/dnds/feats/${hb.id}`,
            }));

            const publicHomebrew = formatHomebrew(publicHomebrewResult, 'Comunidade');
            const myHomebrew = formatHomebrew(myHomebrewResult, 'Meu');

            const combinedHomebrew = [...myHomebrew, ...publicHomebrew.filter(phb => !myHomebrew.some(mhb => mhb.index === phb.index))];

            setAllTraits([...official, ...combinedHomebrew].sort((a,b) => a.name.localeCompare(b.name)));
        } catch (error) {
            console.error("Failed to fetch traits:", error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchTraits();
    }, [fetchTraits]);
    
    const handleTraitCreated = (newTraitContent: any) => {
        const newApiListItem: ApiListItem = {
            index: newTraitContent.id,
            name: `${newTraitContent.name} (Meu)`,
            url: `/api/dnds/feats/${newTraitContent.id}`,
        };
        setAllTraits(prev => [newApiListItem, ...prev].sort((a,b) => a.name.localeCompare(b.name)));
        onSelectionChange([...selectedTraits, newApiListItem]);
    };

    const handleToggleTrait = (trait: ApiListItem) => {
        const isSelected = selectedTraits.some(st => st.index === trait.index);
        if (isSelected) {
            onSelectionChange(selectedTraits.filter(st => st.index !== trait.index));
        } else {
            onSelectionChange([...selectedTraits, trait]);
        }
    };
    
    const filteredTraits = allTraits.filter(trait => 
        trait.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className={hb.section}>
            <h5 className={hb.headingSm}>Traços Raciais</h5>
            <input
                type="text"
                placeholder="Buscar traços..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className={hb.controlSm}
            />
            {isLoading ? (
                <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin text-dnd-parchment-muted" />
                </div>
            ) : (
                <div className={`${hb.pickerPanel} space-y-2`}>
                    {filteredTraits.map(trait => {
                         const isSelected = selectedTraits.some(st => st.index === trait.index);
                        return (
                            <label key={trait.index} className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${isSelected  ? hb.pickerItemSelected : hb.pickerItem}`}>
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleTrait(trait)}
                                    className={hb.checkbox}
                                />
                                <span className="font-ui text-sm text-dnd-parchment">{trait.name}</span>
                            </label>
                        )
                    })}
                </div>
            )}
            <div className="text-right">
                <button type="button" className={hb.linkBtn} onClick={() => setIsCreatorOpen(true)}>
                    <Plus className="h-4 w-4" /> Criar Novo Traço
                </button>
            </div>
            
            <TraitCreator
                isOpen={isCreatorOpen}
                onClose={() => setIsCreatorOpen(false)}
                onTraitCreated={handleTraitCreated}
            />
        </div>
    );
};

export default TraitSelector;
