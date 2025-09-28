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

    const allCombatants = useMemo<Combatant[]>(() => {
        if (!combatState.isActive || !character) {
            return [];
        }

        const combatantMap = new Map<string, Combatant>();

        // Create player combatant from the main character state
        const playerCombatant: Combatant = {
            id: character.name,
            name: character.name,
            hp: character.hp.current,
            maxHp: character.hp.max,
            initiative: 0,
            isDead: character.hp.current <= 0,
            hasMoved: false,
            hasActed: false,
            actionPoints: 1,
            bonusActionPoints: 1,
            conditions: character.conditions,
            rollHistory: [],
            isPlayer: true,
            armorClass: character.ac.value,
        };
        combatantMap.set(playerCombatant.id, playerCombatant);
        
        // Process combatants from the API, merging with player data if necessary
        (combatState.combatants || []).forEach(c => {
            if (!c || !c.id) return;
            const currentHp = typeof c.hp === 'number' ? c.hp : (c.hp as any)?.current;
            const maxHp = typeof c.maxHp === 'number' ? c.maxHp : (c.hp as any)?.max;

            // If it's the player, update the existing entry
            if (c.name === character.name || c.id === playerCombatant.id) {
                const existingPlayer = combatantMap.get(playerCombatant.id)!;
                existingPlayer.initiative = c.initiative ?? existingPlayer.initiative;
                existingPlayer.rollHistory = c.rollHistory || existingPlayer.rollHistory;
                existingPlayer.hp = character.hp.current;
                existingPlayer.maxHp = character.hp.max;
                existingPlayer.actionPoints = c.actionPoints ?? existingPlayer.actionPoints;
                existingPlayer.bonusActionPoints = c.bonusActionPoints ?? existingPlayer.bonusActionPoints;
                existingPlayer.hasActed = c.hasActed ?? existingPlayer.hasActed;
                existingPlayer.hasMoved = c.hasMoved ?? existingPlayer.hasMoved;
            } else { // It's an NPC
                combatantMap.set(c.id, {
                    ...c,
                    hp: typeof currentHp === 'number' ? currentHp : 1,
                    maxHp: typeof maxHp === 'number' ? maxHp : Math.max(currentHp || 1, 1),
                    isPlayer: false,
                });
            }
        });

        // Sort based on initiativeOrder
        if (!combatState.initiativeOrder || combatState.initiativeOrder.length === 0) {
             return Array.from(combatantMap.values()).sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));
        }
    
        const getCombatantId = (entry: any): string => {
            if (typeof entry === 'string') return entry;
            if (entry.id.toLowerCase().includes(character.name.toLowerCase())) return character.name;
            return entry.id;
        }

        return combatState.initiativeOrder
            .map(orderEntry => {
                const id = getCombatantId(orderEntry);
                return combatantMap.get(id);
            })
            .filter((c): c is Combatant => !!c && c.id != null && c.name != null); // Ensure no undefined combatants
    
    }, [combatState, character]);

    if (!combatState.isActive || allCombatants.length === 0) {
        return null;
    }
    
    const { round, turn, initiativeOrder } = combatState;
    if (!initiativeOrder || initiativeOrder.length === 0) return null;
    
    const getCombatantId = (entry: any): string => {
        if (typeof entry === 'string') return entry;
        if (entry.id.toLowerCase().includes(character!.name.toLowerCase())) return character!.name;
        return entry.id;
    }
    
    const currentCombatantIndex = turn % initiativeOrder.length;
    const currentCombatantId = getCombatantId(initiativeOrder[currentCombatantIndex]);
    const currentCombatant = allCombatants.find(c => c.id === currentCombatantId);
    
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
                  { !isExpanded && currentCombatant && <CombatantHeaderInfo combatant={currentCombatant} /> }
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
                                combatant={currentCombatant}
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
                                    <CombatantCard
                                        key={combatant.id}
                                        combatant={combatant}
                                        isCurrentTurn={false}
                                        isPlayer={!!combatant.isPlayer}
                                    />
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
