// src/components/Spellbook.tsx
'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import * as DndApiService from '../services/dndApiService';
import type { ApiSpell } from '../types';
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
    const [breathWeaponUsed, setBreathWeaponUsed] = useState(false);

    // Efeito para resetar o uso da Arma de Sopro quando o personagem se cura totalmente (indicativo de descanso longo)
    useEffect(() => {
        if (character && character.hp.current === character.hp.max) {
            setBreathWeaponUsed(false);
        }
    }, [character?.hp]);

    useEffect(() => {
        const fetchSpells = async () => {
            if (!character || !character.spells) {
                setSpellDetails([]);
                return;
            }
            setIsSpellsLoading(true);

            // A 'character.spells' pode conter strings (índices) ou objetos.
            const spellRefs = character.spells.map(spellIdentifier => {
                const index = typeof spellIdentifier === 'string' 
                    ? spellIdentifier 
                    : (spellIdentifier as any).spellName || (spellIdentifier as any).index;
                return { index: index.toLowerCase().replace(/ /g, '-'), name: index, url: '' };
            }).filter(ref => ref.index);
            
            if (spellRefs.length > 0) {
                const results = await fetchDetailsInChunks(
                    spellRefs,
                    DndApiService.getSpellDetails,
                    (loaded, total) => {
                        setLoadingProgress(`Carregando magias ${loaded} de ${total}...`);
                    }
                );
                setSpellDetails(results.filter((s): s is ApiSpell => s !== null));
            } else {
                setSpellDetails([]);
            }
            
            setIsSpellsLoading(false);
            setLoadingProgress(null);
        };

        fetchSpells();
    }, [character?.spells]);
    
    const handleCastSpell = useCallback((spell: ApiSpell) => {
        if (!character) return;

        if(onModalAction) onModalAction();
        
        if (spell.index.startsWith('breath-weapon')) {
            setBreathWeaponUsed(true);
        }

        const slotLevel = spell.level > 0 ? spell.level : undefined;
        const slotKey = slotLevel ? `level${slotLevel}` : null;
        const slotsBefore = slotKey && character.spellSlots
            ? character.spellSlots[slotKey as keyof typeof character.spellSlots]
            : undefined;

        castSpell(spell, {
            slotLevel,
            slotsBefore: slotsBefore ? { current: slotsBefore.current, max: slotsBefore.max } : undefined,
        });
    }, [onModalAction, castSpell, character]);


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
        
    const isPlayerTurn = combatState?.isActive ? character.id != null && combatState.combatants[combatState.turn]?.id === character.id.toString() : true;

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
                                    let canCast = true;
                                    let usesLeft = undefined;
                                    let maxUses = undefined;

                                    if (spell.index.startsWith('breath-weapon')) {
                                        usesLeft = breathWeaponUsed ? 0 : 1;
                                        maxUses = 1;
                                        canCast = !breathWeaponUsed;
                                    } else {
                                        canCast = spell.level === 0 || (character.spellSlots[`level${spell.level}` as keyof typeof character.spellSlots]?.current || 0) > 0;
                                    }
                                    
                                    return (
                                        <NewSpellCard 
                                            key={spell.index} 
                                            spell={spell}
                                            onCast={handleCastSpell}
                                            canCast={canCast}
                                            isActionLoading={isActionLoading || !!playerRollRequest || !isPlayerTurn}
                                            usesLeft={usesLeft}
                                            maxUses={maxUses}
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
