// src/components/NewJournal.tsx
'use client';
import React, { useState } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import type { JournalEntry } from '../types';
import { ChevronDown, Map, Compass, MapPin } from 'lucide-react';

const PANEL_LEGACY =
  'rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.35)]';
const PANEL_V2 = 'dnd-border-gold dnd-surface-glass rounded-lg shadow-[var(--dnd-shadow-card)]';

interface LocationProps {
    location: JournalEntry;
    level: number;
}

const LocationItem: React.FC<LocationProps> = ({ location, level }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    const hasSubLocations = location.subLocations && location.subLocations.length > 0;

    return (
        <div style={{ paddingLeft: `${level * 0.75}rem` }}>
            <button 
                className={`flex items-center justify-between px-3 py-2 rounded-2xl w-full text-left border border-white/5 bg-black/20 ${hasSubLocations ? 'cursor-pointer hover:bg-white/5' : ''}`} 
                onClick={() => hasSubLocations && setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
            >
                <div className="flex items-center gap-2">
                    {hasSubLocations ? (
                        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                    ) : (
                        <div className="w-4 h-4" />
                    )}
                    <h5 className="font-semibold text-stone-100">{location.name}</h5>
                </div>
                 {location.looted && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-900/70 text-emerald-300 border border-emerald-500/40">Concluído</span>
                )}
            </button>

            <div className={`pl-5 ${isExpanded ? '' : 'hidden'}`}>
                {location.summary && (
                     <p className="text-sm text-stone-400 italic mb-2">{location.summary}</p>
                )}

                {hasSubLocations && (
                    <div className="mt-2 border-l border-white/10">
                        {location.subLocations?.map(subLoc => (
                            <LocationItem key={subLoc.id} location={subLoc} level={level + 1} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};


const NewJournal: React.FC<{ variant?: 'legacy' | 'v2' }> = ({ variant = 'legacy' }) => {
    const PANEL = variant === 'v2' ? PANEL_V2 : PANEL_LEGACY;
    const { character } = useGameStateContext();
    const currentRegion = character?.worldState?.currentRegion || character?.currentRegion || 'Desconhecida';
    const currentPoi =
        character?.worldState?.poiName ||
        (typeof character?.worldState?.poi === 'object' ? character?.worldState?.poi?.name : undefined);
    const currentLocationLabel = currentPoi ? `${currentRegion} - ${currentPoi}` : currentRegion;


    if (!character || !character.journal || character.journal.length === 0) {
        return (
             <div className="p-5 space-y-4 text-sm text-stone-200">
                <div className={`${PANEL} p-5 space-y-2`}>
                    <div className="flex items-center gap-3">
                        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-black/40 border border-white/10 text-amber-200">
                            <Map className="h-6 w-6" />
                        </span>
                        <div>
                            <p className="text-[11px] uppercase tracking-[0.35em] text-amber-200">Diário de Aventura</p>
                            <h3 className="text-2xl font-serif text-white">Cartógrafo em Branco</h3>
                        </div>
                    </div>
                    <p className="text-sm text-stone-400 flex items-center gap-2"><Compass className="h-4 w-4"/> Região Atual: <span className="font-semibold text-amber-200">{currentLocationLabel}</span></p>
                </div>
                <div className="text-center text-stone-400 italic p-8 rounded-3xl border border-white/10 bg-black/30">
                    <p>Seu diário está vazio.</p>
                    <p className="text-sm mt-1">Locais importantes que você descobrir aparecerão aqui.</p>
                </div>
            </div>
        );
    }
    
    // Agrupa as entradas do diário que não têm um pai (são de nível superior) por região.
    const groupedLocations = character.journal.filter(loc => !loc.parentLocation).reduce((acc, loc) => {
        const region = loc.region || 'Outras Regiões';
        if (!acc[region]) {
            acc[region] = [];
        }
        acc[region].push(loc);
        return acc;
    }, {} as Record<string, JournalEntry[]>);

    return (
        <div className="p-5 space-y-5 text-sm text-stone-200">
            <div className={`${PANEL} p-5 space-y-2`}>
                <div className="flex items-center gap-3">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-black/40 border border-white/10 text-amber-200">
                        <Map className="h-6 w-6" />
                    </span>
                    <div>
                        <p className="text-[11px] uppercase tracking-[0.35em] text-amber-200">Diário de Aventura</p>
                        <h3 className="text-2xl font-serif text-white">Cartografia Viva</h3>
                    </div>
                </div>
                <p className="text-sm text-stone-400 flex items-center gap-2"><MapPin className="h-4 w-4"/> Região Atual: <span className="font-semibold text-amber-200">{currentLocationLabel}</span></p>
            </div>

            <div className="space-y-4">
                {Object.entries(groupedLocations).map(([region, locations]) => (
                    <div key={region} className={`${PANEL} p-4 space-y-2`}>
                        <h4 className="text-sm font-semibold uppercase tracking-widest text-amber-200">{region}</h4>
                        <div className="space-y-2">
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
