// src/components/Spellbook.tsx
'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import * as DndApiService from '../services/dndApiService';
import type { ApiSpell } from '../types';
import { fetchDetailsInChunks } from '../utils/apiUtils';
import NewSpellCard from './Spells/NewSpellCard';
import { Book, Loader2, Sparkles, Wand } from 'lucide-react';

const PANEL = 'rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.35)]';

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
        <div className="p-5 space-y-4 text-sm text-stone-200">
            <div className={`${PANEL} p-5 space-y-3`}>
                <div className="flex items-center gap-3">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-black/40 border border-white/10 text-amber-200">
                        <Book className="h-6 w-6" />
                    </span>
                    <div>
                        <p className="text-[11px] uppercase tracking-[0.35em] text-amber-200">grimório vivo</p>
                        <h3 className="text-2xl font-serif text-white leading-tight">Magias & Conjurações</h3>
                        <p className="text-xs text-stone-400">Magias conhecidas: {spellDetails.length}</p>
                    </div>
                </div>

                {spellSlotLevels.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                        {spellSlotLevels.map(level => {
                            const slotKey = `level${level}` as keyof typeof character.spellSlots;
                            const slots = character.spellSlots[slotKey];
                            if (!slots || slots.max === 0) return null;
                            return (
                                <div key={level} className="rounded-2xl border border-white/10 bg-black/30 p-3 text-center">
                                    <p className="text-[10px] uppercase tracking-[0.45em] text-stone-400">Nível {level}</p>
                                    <p className="font-mono text-amber-200 text-lg">{slots.current}/{slots.max}</p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

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
                        <div key={levelKey} className={`${PANEL} p-4`}>
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-semibold uppercase tracking-widest text-amber-200 flex items-center gap-2">
                                    <Sparkles className="h-4 w-4" />
                                    {levelKey === 'Nível 0' ? 'Truques' : levelKey}
                                </h4>
                                <span className="text-xs text-stone-400 flex items-center gap-1"><Wand className="h-3 w-3" />{groupedSpells[levelKey].length}</span>
                            </div>
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
