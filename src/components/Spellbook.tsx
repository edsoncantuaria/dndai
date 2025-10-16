// src/components/Spellbook.tsx
'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import * as DndApiService from '../services/dndApiService';
import type { ApiSpell, CharacterSpell } from '../types';
import { fetchDetailsInChunks } from '../utils/apiUtils';
import NewSpellCard from './Spells/NewSpellCard';
import { Book, Loader2 } from 'lucide-react';

interface SpellbookProps {
    onModalAction?: () => void;
}

const Spellbook: React.FC<SpellbookProps> = ({ onModalAction }) => {
    const { character, castSpell, isLoading: isActionLoading, playerRollRequest, combatState } = useGameStateContext();
    const [spellDetails, setSpellDetails] = useState<ApiSpell[]>([]);
    const [isSpellsLoading, setIsSpellsLoading] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState<string | null>(null);

    useEffect(() => {
        const fetchSpells = async () => {
            if (!character || !character.spells || character.spells.length === 0) {
                setSpellDetails([]);
                return;
            };
            setIsSpellsLoading(true);

            // Separate spells that already have full details from those that need fetching.
            // This correctly handles special abilities like Breath Weapon.
            const existingDetails: ApiSpell[] = [];
            const spellsToFetch: { index: string; name: string; url: string; }[] = [];

            for (const spell of character.spells) {
                // If it's a full object with a description, it's already detailed.
                if (typeof spell === 'object' && 'desc' in spell && spell.desc) {
                    existingDetails.push(spell as ApiSpell);
                }
                // If it's a reference object, add it to the fetch list.
                else if (typeof spell === 'object' && 'spellName' in spell && spell.spellName) {
                    // CRITICAL FIX: Do not attempt to fetch special abilities that don't exist in the spells API.
                    if (!spell.spellName.startsWith('breath-weapon')) {
                        spellsToFetch.push({
                            index: spell.spellName.toLowerCase().replace(/ /g, '-'),
                            name: spell.spellName,
                            url: ''
                        });
                    }
                }
            }
            
            // If there's nothing new to fetch, just set the existing ones and finish.
            if (spellsToFetch.length === 0) {
                setSpellDetails(existingDetails);
                setIsSpellsLoading(false);
                return;
            }

            const results = await fetchDetailsInChunks(
                spellsToFetch,
                DndApiService.getSpellDetails,
                (loaded, total) => {
                    setLoadingProgress(`Carregando magias ${loaded} de ${total}...`);
                }
            );
            
            // Combine fetched spells with ones that already had details
            setSpellDetails([...existingDetails, ...results as ApiSpell[]]);
            setIsSpellsLoading(false);
            setLoadingProgress(null);
        };

        fetchSpells();
    }, [character?.spells]);

    const handleCastSpell = (spell: ApiSpell) => {
        if(onModalAction) onModalAction();
        castSpell(spell);
    }

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
    
    const spellSlotLevels = Object.keys(character.spellSlots || {})
        .map(key => parseInt(key.replace('level', '')))
        .sort((a, b) => a - b);
        
    const isPlayerTurn = combatState?.isActive ? character.id != null && combatState.combatants[combatState.turn]?.id.toString() === character.id.toString() : true;

    return (
        <div className="p-4 space-y-4">
            <h3 className="text-lg font-bold font-garamond text-amber-300 flex items-center gap-2">
                <Book />
                Grimório
            </h3>

            {spellSlotLevels.length > 0 && (
                 <div className="bg-stone-800/50 p-3 rounded-lg border border-stone-700">
                    <h4 className="font-semibold text-stone-300 text-sm mb-2">Espaços de Magia</h4>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {spellSlotLevels.map(level => {
                            const slotKey = `level${level}` as keyof typeof character.spellSlots;
                            const slots = character.spellSlots[slotKey];
                            if (!slots || slots.max === 0) return null;
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
                    <Loader2 className="animate-spin" />
                    <span className="ml-2">{loadingProgress || 'Consultando grimório...'}</span>
                </div>
            ) : (!spellDetails || spellDetails.length === 0) ? (
                <p className="text-stone-400 italic">Você não conhece nenhuma magia.</p>
            ) : (
                <div className="space-y-4">
                    {spellLevelOrder.map(levelKey => (
                        <div key={levelKey}>
                            <h4 className="font-semibold text-amber-200 border-b border-stone-700 pb-1 mb-2">
                                {levelKey === 'Nível 0' ? 'Truques' : levelKey}
                            </h4>
                            <div className="space-y-2">
                                {groupedSpells[levelKey].sort((a,b) => a.name.localeCompare(b.name)).map(spell => {
                                    const canCast = spell.level === 0 || (character.spellSlots[`level${spell.level}` as keyof typeof character.spellSlots]?.current || 0) > 0;
                                    return (
                                        <NewSpellCard 
                                            key={spell.index} 
                                            spell={spell}
                                            onCast={handleCastSpell}
                                            canCast={canCast}
                                            isActionLoading={isActionLoading || !!playerRollRequest || !isPlayerTurn}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Spellbook;
