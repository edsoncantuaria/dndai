'use client';
import React, { useState } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import type { JournalEntryLocation } from '../types';
import { ChevronDown, Map } from 'lucide-react';

interface LocationProps {
    location: JournalEntryLocation;
    level: number;
}

const LocationItem: React.FC<LocationProps> = ({ location, level }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const hasSubLocations = location.subLocations && location.subLocations.length > 0;

    return (
        <div style={{ paddingLeft: `${level * 1}rem` }}>
            <button 
                className={`flex items-center justify-between p-2 rounded-md w-full text-left ${hasSubLocations ? 'cursor-pointer hover:bg-stone-800' : ''}`} 
                onClick={() => hasSubLocations && setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
            >
                <div className="flex items-center gap-2">
                    {hasSubLocations ? (
                        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                    ) : (
                        <div className="w-4 h-4" /> // Placeholder for alignment
                    )}
                    <h5 className="font-semibold text-stone-200">{location.name}</h5>
                </div>
                 {location.looted && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-green-900/70 text-green-300">Concluído</span>
                )}
            </button>

            <div className={`pl-6 ${isExpanded ? '' : 'hidden'}`}>
                {location.summary && (
                     <p className="text-sm text-stone-400 italic mb-2">{location.summary}</p>
                )}

                {hasSubLocations && (
                    <div className="mt-1 border-l-2 border-stone-700/50">
                        {location.subLocations?.map(subLoc => (
                            <LocationItem key={subLoc.id} location={subLoc} level={level + 1} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};


const NewJournal: React.FC = () => {
    const { character } = useGameStateContext();

    if (!character || !character.journal || character.journal.length === 0) {
        return (
             <div className="p-4 space-y-4">
                <h3 className="text-lg font-bold font-garamond text-amber-300 flex items-center gap-2">
                    <Map />
                    Diário de Aventura
                </h3>
                <div className="text-center text-stone-400 italic p-8 bg-stone-800/50 rounded-lg">
                    <p>Seu diário está vazio.</p>
                    <p className="text-sm">Locais importantes que você descobrir aparecerão aqui.</p>
                </div>
            </div>
        );
    }
    
    // Agrupa as entradas do diário por região.
    const groupedLocations = character.journal.reduce((acc, loc) => {
        const region = loc.region || 'Outras Regiões';
        if (!acc[region]) {
            acc[region] = [];
        }
        acc[region].push(loc);
        return acc;
    }, {} as Record<string, JournalEntryLocation[]>);

    return (
        <div className="p-4 space-y-4">
            <h3 className="text-lg font-bold font-garamond text-amber-300 flex items-center gap-2 text-shadow-amber">
                <Map />
                Diário de Aventura
            </h3>
            
            <div className="bg-stone-800/50 p-3 rounded-lg border border-stone-700">
                <p className="text-sm text-stone-400">Região Atual: <span className="font-semibold text-amber-300">{character.currentRegion}</span></p>
            </div>

            <div className="space-y-4">
                {Object.entries(groupedLocations).map(([region, locations]) => (
                    <div key={region}>
                        <h4 className="font-semibold text-amber-200 border-b border-stone-700 pb-1 mb-2">
                            {region}
                        </h4>
                        <div className="space-y-1">
                            {locations.map(loc => (
                                <LocationItem key={loc.id} location={loc} level={0} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default NewJournal;
