// src/components/NewCombatTracker.tsx
'use client';
import React, { useMemo, useState } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import CombatantCard from './CombatantCard';
import type { Combatant } from '../types';
import { Swords, ChevronDown, Loader2 } from 'lucide-react';
import CombatantHeaderInfo from './CombatantHeaderInfo';

const NewCombatTracker: React.FC = () => {
    const { combatState, character, nextTurn, isLoading } = useGameStateContext();
    const [isExpanded, setIsExpanded] = useState(true);

    const getCombatantId = (combatantOrId: any): string => {
        if (!combatantOrId) return '';
        if (typeof combatantOrId === 'string') return combatantOrId;
        return combatantOrId.id || combatantOrId.name || '';
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
            initiative: 0,
            isDead: character.hp.current <= 0,
            hasMoved: false,
            hasActed: false,
            actionPoints: 1,
            bonusActionPoints: 1,
            conditions: character.conditions.map(c => c.name),
            rollHistory: [],
        };
        combatantMap.set('player', playerCombatant);
        
        (combatState.combatants || []).forEach(apiCombatant => {
            if (!apiCombatant || !apiCombatant.name) return;

            const id = getCombatantId(apiCombatant);
            if (!id) return;
            
            const isPlayer = id === 'player';

            const existing = combatantMap.get(id) || (isPlayer ? playerCombatant : {});
            
            const currentHp = typeof apiCombatant.hp === 'object' && apiCombatant.hp !== null ? apiCombatant.hp.current : (typeof apiCombatant.hp === 'number' ? apiCombatant.hp : 1);
            const maxHp = typeof apiCombatant.hp === 'object' && apiCombatant.hp !== null ? apiCombatant.hp.max : (apiCombatant.maxHp ?? 1);

            const mergedCombatant: Combatant = {
                ...existing,
                ...apiCombatant,
                id,
                isPlayer,
                 hp: {
                    current: currentHp,
                    max: maxHp,
                },
                ac: apiCombatant.ac ?? existing.ac ?? 10,
                isDead: apiCombatant.isDead ?? (currentHp <= 0),
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

    return (
        <div className="flex-shrink-0 bg-red-950/40 backdrop-blur-sm p-3 rounded-lg border-2 border-red-800/80 mt-4 animate-fadeIn shadow-2xl shadow-red-950/50">
            <button 
                className="flex justify-between items-center w-full"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
            >
                <h3 className="text-xl font-bold font-garamond text-red-200 flex items-center gap-2">
                    <Swords /> 
                    <span>COMBATE ATIVO</span>
                </h3>

                <div className="flex items-center gap-4">
                  { !isExpanded && currentCombatant && <CombatantHeaderInfo combatant={currentCombatant as Combatant} /> }
                  <span className="font-mono text-lg text-red-300">Round {round}</span>
                  <ChevronDown className={`h-6 w-6 transition-transform text-red-300 hover:text-white ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {isExpanded && (
                <div className="mt-4 animate-fadeIn" style={{ animationDuration: '300ms'}}>
                    {currentCombatant && (
                        <div className="space-y-3">
                            <p className="text-amber-300 font-semibold uppercase text-sm">Turno Atual: {currentCombatant.name}</p>
                            <CombatantCard
                                key={currentCombatant.id}
                                combatant={currentCombatant as Combatant}
                                isCurrentTurn={true}
                                isPlayer={!!currentCombatant.isPlayer}
                            />
                        </div>
                    )}
                    
                    {upcomingCombatants.length > 0 && (
                        <div className="mt-4 space-y-2">
                            <p className="text-stone-300 font-semibold uppercase text-sm">Próximos</p>
                            <div className="space-y-3 opacity-80">
                                {upcomingCombatants.map((combatant) => (
                                    combatant ? (
                                        <CombatantCard
                                            key={combatant.id}
                                            combatant={combatant as Combatant}
                                            isCurrentTurn={false}
                                            isPlayer={!!combatant.isPlayer}
                                        />
                                    ) : null
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
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
    );
};

export default NewCombatTracker;
