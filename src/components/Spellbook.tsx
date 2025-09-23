'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import * as DndApiService from '../services/dndApiService';
import type { ApiSpell } from '../types';
import { Icons } from './Icons';
import SpellCard from './SpellCard';
import { fetchDetailsInChunks } from '../utils/apiUtils';
import { translateSpell } from '../utils/translator';

const Spellbook: React.FC = () => {
    const { character, castSpell, isLoading: isActionLoading } = useGameStateContext();
    const [spellDetails, setSpellDetails] = useState<ApiSpell[]>([]);
    const [isSpellsLoading, setIsSpellsLoading] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState<string | null>(null);

    useEffect(() => {
        const fetchSpells = async () => {
            if (!character || character.spells.length === 0) {
                setSpellDetails([]);
                return;
            };
            setIsSpellsLoading(true);
            
            const spellList = character.spells.map(s => ({ index: s, name: s, url: '' }));

            const results = await fetchDetailsInChunks(
                spellList,
                DndApiService.getSpellDetails,
                (loaded, total) => {
                    setLoadingProgress(`Carregando magias ${loaded} de ${total}...`);
                }
            );
            
            setSpellDetails(results.map(spell => translateSpell(spell) as ApiSpell));
            setIsSpellsLoading(false);
            setLoadingProgress(null);
        };

        fetchSpells();
    }, [character?.spells]);

    const groupedSpells = useMemo(() => {
        return spellDetails.reduce((acc, spell) => {
            if (!spell) return acc;
            const level = `Nível ${spell.level}`;
            if (!acc[level]) {
                acc[level] = [];
            }
            acc[level].push(spell);
            return acc;
        }, {} as Record<string, ApiSpell[]>);
    }, [spellDetails]);

    if (!character) return null;

    const spellLevelOrder = Object.keys(groupedSpells).sort((a, b) => {
        if (a.includes('0')) return -1; // Cantrips first
        if (b.includes('0')) return 1;
        return a.localeCompare(b, undefined, { numeric: true });
    });
    
    const spellSlotLevels = Object.keys(character.spellSlots)
        .map(key => parseInt(key.replace('level', '')))
        .sort((a, b) => a - b);


    return (
        <div className="p-4 space-y-4">
            <h3 className="text-lg font-bold font-garamond text-amber-300 flex items-center gap-2">
                <Icons.Book />
                Grimório
            </h3>

            {spellSlotLevels.length > 0 && (
                 <div className="bg-stone-800/50 p-3 rounded-lg border border-stone-700">
                    <h4 className="font-semibold text-stone-300 text-sm mb-2">Espaços de Magia</h4>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {spellSlotLevels.map(level => {
                            const slotKey = `level${level}` as keyof typeof character.spellSlots;
                            const slots = character.spellSlots[slotKey];
                            return (
                                <div key={level} className="text-center">
                                    <div className="text-xs text-stone-400">Nível {level}</div>
                                    <div className="font-mono font-bold text-amber-300 text-lg">
                                        {slots.current}/{slots.max}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                 </div>
            )}

            {isSpellsLoading ? (
                <div className="flex items-center justify-center p-4 text-stone-400">
                    <Icons.Spinner />
                    <span className="ml-2">{loadingProgress || 'Consultando grimório...'}</span>
                </div>
            ) : character.spells.length === 0 ? (
                <p className="text-stone-400 italic">Você não conhece nenhuma magia.</p>
            ) : (
                <div className="space-y-4">
                    {spellLevelOrder.map(levelKey => (
                        <div key={levelKey}>
                            <h4 className="font-semibold text-amber-200 border-b border-stone-700 pb-1 mb-2">
                                {levelKey === 'Nível 0' ? 'Truques' : levelKey}
                            </h4>
                            <div className="space-y-2">
                                {groupedSpells[levelKey].map(spell => (
                                    <SpellCard 
                                        key={spell.index} 
                                        spell={spell}
                                        onCast={castSpell}
                                        canCast={spell.level === 0 || (character.spellSlots[`level${spell.level}` as keyof typeof character.spellSlots]?.current || 0) > 0}
                                        isActionLoading={isActionLoading}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Spellbook;
