// src/components/Homebrew/TraitSelector.tsx
'use client';
import React, { useState, useEffect, useCallback } from 'react';
import * as DndApiService from '@/services/dndApiService';
import * as HomebrewService from '@/services/homebrewService';
import { ApiListItem } from '@/types';
import { Loader2, Plus } from 'lucide-react';
import { translateApiString } from '@/utils/translator';
import TraitCreator from './TraitCreator'; // Importar o novo componente
import { useAuth } from '@/contexts/AuthContext';

interface Props {
    selectedTraits: ApiListItem[];
    onSelectionChange: (traits: ApiListItem[]) => void;
}

const TraitSelector: React.FC<Props> = ({ selectedTraits, onSelectionChange }) => {
    const { user } = useAuth(); // Usar o hook de autenticação
    const [allTraits, setAllTraits] = useState<ApiListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreatorOpen, setIsCreatorOpen] = useState(false); // Estado para o modal

    const fetchTraits = useCallback(async () => {
        setIsLoading(true);
        try {
            const officialTraitsPromise = DndApiService.getTraits();
            // Busca tanto os traços públicos quanto os do próprio usuário
            const publicHomebrewPromise = HomebrewService.listHomebrewContent('public', 'feat');
            // Só busca "mine" se o usuário estiver logado.
            const myHomebrewPromise = user ? HomebrewService.listHomebrewContent('mine', 'feat') : Promise.resolve([]);


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

            // Combina e remove duplicatas (caso um item "meu" também seja "público")
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
    
    // Callback para quando um novo traço é criado
    const handleTraitCreated = (newTraitContent: any) => {
        // Adiciona o novo traço à lista local e o seleciona automaticamente
        const newApiListItem: ApiListItem = {
            index: newTraitContent.index, // Usa o index do conteúdo retornado
            name: `${newTraitContent.name} (Meu)`,
            url: `/api/dnds/feats/${newTraitContent.index}`, // Usa o index na URL
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
        <div className="space-y-3">
            <h5 className="text-sm font-medium text-stone-300 mb-2">Traços Raciais</h5>
            <input
                type="text"
                placeholder="Buscar traços..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-stone-800 border-stone-700 rounded-md p-2 text-sm text-stone-200"
            />
            {isLoading ? (
                <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
                </div>
            ) : (
                <div className="max-h-48 overflow-y-auto space-y-2 rounded-md bg-stone-900/50 p-2 border border-stone-700 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {filteredTraits.map(trait => {
                         const isSelected = selectedTraits.some(st => st.index === trait.index);
                        return (
                            <label key={trait.index} className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${isSelected ? 'bg-amber-900/40' : 'hover:bg-stone-800'}`}>
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleTrait(trait)}
                                    className="form-checkbox h-4 w-4 text-amber-500 bg-stone-700 border-stone-600 rounded focus:ring-amber-500"
                                />
                                <span className="text-sm text-stone-300">{translateApiString(trait.name)}</span>
                            </label>
                        )
                    })}
                </div>
            )}
            <div className="text-right">
                <button type="button" className="mt-2 text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1" onClick={() => setIsCreatorOpen(true)}>
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
