
// components/JournalTab.tsx
import React, { useMemo } from 'react';
import { Icons } from './Icons';
import { useGameStateContext } from '../contexts/GameStateContext';
import { JournalEntryLocation } from '../types';

const JournalTab: React.FC = () => {
    const { character } = useGameStateContext();

    const groupedLocations = useMemo(() => {
        if (!character) return {};
        // FIX: Add explicit type to the reduce accumulator to help TypeScript inference.
        return character.journal.reduce((acc: Record<string, JournalEntryLocation[]>, loc) => {
            const region = loc.region || 'Outros Locais';
            if (!acc[region]) {
                acc[region] = [];
            }
            acc[region].push(loc);
            return acc;
        }, {})
    }, [character?.journal]);

    if (!character) return null;

    return (
        <div className="p-4 space-y-4">
            <h3 className="text-lg font-bold font-garamond text-amber-300 flex items-center gap-2">
                <Icons.Map />
                Diário de Aventura
            </h3>
            
            <div className="bg-stone-800/50 p-3 rounded-lg border border-stone-700">
                <p className="text-sm text-stone-400">Região Atual: <span className="font-semibold text-amber-300">{character.currentRegion}</span></p>
            </div>

            {character.journal.length === 0 ? (
                <div className="text-center text-stone-400 italic p-8 bg-stone-800/50 rounded-lg">
                    <p>Seu diário está vazio.</p>
                    <p className="text-sm">Locais importantes e missões que você descobrir aparecerão aqui.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {Object.entries(groupedLocations).map(([region, locations]) => (
                        <div key={region}>
                            <h4 className="font-semibold text-amber-200 border-b border-stone-700 pb-1 mb-2">
                                {region}
                            </h4>
                            <div className="space-y-3">
                                {locations.map(loc => (
                                    <div key={loc.id} className="bg-stone-800/70 p-3 rounded-lg border border-stone-700">
                                        <h5 className="font-semibold text-stone-200">{loc.name}</h5>
                                        <p className="text-sm text-stone-400">{loc.summary}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default JournalTab;