// src/components/NewCombatTracker.tsx
'use client';
import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStateContext } from '../contexts/GameStateContext';
import CombatantCard from './CombatantCard';
import type { Combatant } from '../types';
import { Swords, ChevronDown, Loader2 } from 'lucide-react';
import CombatantHeaderInfo from './CombatantHeaderInfo';
import { cn } from '@/lib/utils';

const NewCombatTracker: React.FC = () => {
    const { combatState, character, nextTurn, isLoading, log } = useGameStateContext();
    const [isExpanded, setIsExpanded] = useState(false); // Iniciar recolhido

    const getCombatantId = (combatantOrId: any): string => {
        if (!combatantOrId) return '';
        if (typeof combatantOrId === 'string') return combatantOrId;
        return combatantOrId.id || combatantOrId.name || '';
    };
    
    const rollEntries = useMemo(() => {
        return (log || []).filter(entry => entry?.type === 'roll' && typeof entry.content === 'string');
    }, [log]);

    const extractRollSummary = (content: string) => {
        const totalMatch = content.match(/(\d+)(?!.*\d)/);
        const diceMatch = content.match(/(\d+d\d+)/i);
        return {
            total: totalMatch ? Number(totalMatch[1]) : undefined,
            dice: diceMatch ? diceMatch[1] : undefined,
        };
    };

    const buildRollHistory = (name?: string) => {
        if (!name) return [];
        const key = name.toLowerCase();
        return rollEntries
            .filter(entry => entry.content.toLowerCase().includes(key))
            .slice(-5)
            .map(entry => {
                const summary = extractRollSummary(entry.content);
                return {
                    type: 'log',
                    description: entry.content,
                    total: summary.total,
                    dice: summary.dice,
                    rolls: [],
                };
            });
    };

    const allCombatants = useMemo<Combatant[]>(() => {
        if (!combatState.isActive || !character) return [];

        const combatantMap = new Map<string, Combatant>();

        // Player is always added first with a consistent ID.
        const playerCombatant: Combatant = {
            id: 'player', 
            name: character.name,
            hp: { current: character.hp.current, max: character.hp.max },
            ac: character.ac.value,
            isPlayer: true,
            attitude: 'ally',
            initiative: 0,
            isDead: character.hp.current <= 0,
            hasMoved: false,
            hasActed: false,
            actionPoints: 3,
            bonusActionPoints: 1,
            conditions: character.conditions.map(c => c.name),
            rollHistory: buildRollHistory(character.name),
        };
        combatantMap.set('player', playerCombatant);
        
        (combatState.combatants || []).forEach(apiCombatant => {
            if (!apiCombatant || !apiCombatant.name) return;

            const id = getCombatantId(apiCombatant);
            if (!id) return;
            
            const isPlayer = id === 'player';
            const attitude = (apiCombatant.attitude as Combatant['attitude']) ?? (isPlayer ? 'ally' : 'hostile');

            const existing = combatantMap.get(id) || (isPlayer ? playerCombatant : {});
            
            const currentHp = typeof apiCombatant.hp === 'object' && apiCombatant.hp !== null ? apiCombatant.hp.current : (typeof apiCombatant.hp === 'number' ? apiCombatant.hp : 1);
            const maxHp = typeof apiCombatant.hp === 'object' && apiCombatant.hp !== null ? apiCombatant.hp.max : (apiCombatant.maxHp ?? 1);

            const mergedCombatant: Combatant = {
                ...existing,
                ...apiCombatant,
                id,
                isPlayer,
                attitude,
                hp: {
                   current: currentHp,
                   max: maxHp,
                },
                ac: apiCombatant.ac ?? existing.ac ?? 10,
                isDead: apiCombatant.isDead ?? (currentHp <= 0),
                rollHistory: apiCombatant.rollHistory && apiCombatant.rollHistory.length
                    ? apiCombatant.rollHistory
                    : buildRollHistory(apiCombatant.name ?? id),
            };
            
            combatantMap.set(id, mergedCombatant);
        });
        
        const validCombatants = Array.from(combatantMap.values());

        if (!combatState.initiativeOrder || combatState.initiativeOrder.length === 0) {
             return validCombatants.sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));
        }
    
        return combatState.initiativeOrder
            .map(orderEntry => {
                const id = getCombatantId(orderEntry);
                return combatantMap.get(id);
            })
            .filter((c): c is Combatant => c !== undefined);

    }, [combatState, character]);

    if (!combatState.isActive || allCombatants.length === 0) {
        return null;
    }
    
    const { round, turn, initiativeOrder } = combatState;
    if (!initiativeOrder || initiativeOrder.length === 0) return null;
    
    const currentCombatantIndex = turn % initiativeOrder.length;
    const currentCombatantId = getCombatantId(initiativeOrder[currentCombatantIndex]);
    const currentCombatant = allCombatants.find(c => getCombatantId(c) === currentCombatantId);
    
    // Auto-expande no turno do jogador
    useEffect(() => {
        if (currentCombatant?.isPlayer) {
            setIsExpanded(true);
        }
    }, [currentCombatant]);

    const upcomingCombatants = [];
    if (allCombatants.length > 1) {
        for (let i = 1; i < allCombatants.length; i++) {
            const nextIndex = (currentCombatantIndex + i) % allCombatants.length;
            const nextCombatant = allCombatants[nextIndex];
            if (nextCombatant && !nextCombatant.isDead) {
                upcomingCombatants.push(nextCombatant);
            }
        }
    }

    const isPlayerTurn = currentCombatant?.isPlayer || false;

    const containerGlow = isPlayerTurn
        ? 'border-amber-500/70 shadow-[0_0_25px_rgba(251,191,36,0.35)]'
        : 'border-red-800/80 shadow-[0_0_30px_rgba(239,68,68,0.25)]';
    const headerAccent = isPlayerTurn ? 'text-amber-200' : 'text-red-200';

    return (
        <motion.div
            className={cn(
                'relative flex-shrink-0 w-full overflow-hidden backdrop-blur-sm p-3 rounded-2xl border',
                containerGlow
            )}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <div className={cn('absolute inset-0 pointer-events-none bg-gradient-to-r opacity-40', isPlayerTurn ? 'from-amber-500/20 via-amber-300/10 to-transparent' : 'from-red-600/20 via-rose-500/10 to-transparent')} />
            <div className="relative">
            <button 
                className="flex justify-between items-center w-full"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
            >
                <h3 className={cn('text-xl font-bold font-garamond flex items-center gap-2', headerAccent)}>
                    <Swords /> 
                    <span>COMBATE ATIVO</span>
                </h3>

                <div className="flex items-center gap-4">
                  { !isExpanded && currentCombatant && <CombatantHeaderInfo combatant={currentCombatant as Combatant} /> }
                  <span className={cn('font-mono text-lg', headerAccent)}>Round {round}</span>
                  <ChevronDown className={cn('h-6 w-6 transition-transform hover:text-white', headerAccent, { 'rotate-180': isExpanded })} />
                </div>
            </button>

            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        key="combat-body"
                        className="mt-4 max-h-[60vh] sm:max-h-[70vh] overflow-y-auto pr-2"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                    >
                        {currentCombatant && (
                            <motion.div
                                className="space-y-3"
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <p className="text-amber-300 font-semibold uppercase text-sm">Turno Atual: {currentCombatant.name}</p>
                                <CombatantCard
                                    key={currentCombatant.id}
                                    combatant={currentCombatant as Combatant}
                                    isCurrentTurn={true}
                                    isPlayer={!!currentCombatant.isPlayer}
                                />
                            </motion.div>
                        )}
                        
                        {upcomingCombatants.length > 0 && (
                            <div className="mt-4 space-y-2">
                                <p className="text-stone-300 font-semibold uppercase text-sm">Próximos</p>
                                <div className="space-y-3 opacity-90">
                                    <AnimatePresence>
                                        {upcomingCombatants.map((combatant) =>
                                            combatant ? (
                                                <motion.div
                                                    key={combatant.id}
                                                    initial={{ opacity: 0, x: 12 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: -10 }}
                                                >
                                                    <CombatantCard
                                                        combatant={combatant as Combatant}
                                                        isCurrentTurn={false}
                                                        isPlayer={!!combatant.isPlayer}
                                                    />
                                                </motion.div>
                                            ) : null
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {!isPlayerTurn && (
                <div className="mt-4 text-center">
                    <button
                        onClick={nextTurn}
                        disabled={isLoading}
                        className="w-full px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-stone-900 font-bold transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Próximo Turno' }
                    </button>
                </div>
            )}
            </div>
        </motion.div>
    );
};

export default NewCombatTracker;
