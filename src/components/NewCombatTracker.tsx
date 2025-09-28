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
        if (!combatState.isActive || !Array.isArray(combatState.combatants) || !character) return [];

        const combatantMap = new Map<string, Combatant>();

        // Process all combatants from the state
        combatState.combatants.forEach(c => {
            const currentHp = typeof c.hp === 'number' ? c.hp : (c.hp as any)?.current;
            const maxHp = typeof c.maxHp === 'number' ? c.maxHp : (c.hp as any)?.max;

            const combatant: Combatant = {
                ...c,
                hp: typeof currentHp === 'number' ? currentHp : 1, 
                maxHp: typeof maxHp === 'number' ? maxHp : currentHp || 1,
                // NEW: Explicitly mark the player combatant
                isPlayer: c.name === character.name,
            };
            
            if(typeof currentHp !== 'number' || typeof maxHp !== 'number'){
                 console.warn(`Combatant ${c.name} (${c.id}) is missing valid HP values. Received:`, c.hp);
            }
            combatantMap.set(c.id, combatant);
        });

        // Ensure player is in the map
        const playerInMap = Array.from(combatantMap.values()).some(c => c.isPlayer);
        if (!playerInMap) {
           console.error("Player character is not in the combatant list from AI.");
           // Optional: You could try to manually inject the player here as a fallback
           return [];
        }
        
        if (!combatState.initiativeOrder || combatState.initiativeOrder.length === 0) {
            return Array.from(combatantMap.values()).sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));
        }

        // Handle both string array and object array for initiativeOrder
        const getCombatantId = (entry: any): string => typeof entry === 'string' ? entry : entry.id;

        return combatState.initiativeOrder
            .map(orderEntry => combatantMap.get(getCombatantId(orderEntry)))
            .filter((c): c is Combatant => !!c);

    }, [combatState, character]);

    if (!combatState.isActive || allCombatants.length === 0) {
        return null;
    }
    
    const { round, turn, initiativeOrder } = combatState;
    if (!initiativeOrder || initiativeOrder.length === 0) return null;
    
    const getCombatantId = (entry: any): string => typeof entry === 'string' ? entry : entry.id;

    const currentCombatantId = getCombatantId(initiativeOrder[turn % initiativeOrder.length]);
    const currentCombatant = allCombatants.find(c => c.id === currentCombatantId);
    
    // Create the list of upcoming combatants, ensuring the current one isn't duplicated
    const upcomingCombatants = [];
    if (allCombatants.length > 1) {
        for (let i = 1; i < allCombatants.length; i++) {
            const nextIndex = (turn + i) % allCombatants.length;
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
                                isPlayer={isPlayerTurn}
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
                                        isPlayer={combatant.isPlayer || false}
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