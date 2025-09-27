'use client';
import React, { useMemo } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import CombatantCard from './CombatantCard';
import type { Combatant } from '../types';
import { Swords } from 'lucide-react';


const NewCombatTracker: React.FC = () => {
    const { combatState, nextTurn } = useGameStateContext();

    if (!combatState || !combatState.isActive || !combatState.combatants || combatState.combatants.length === 0) {
        return null;
    }

    const { round, combatants, turn, initiativeOrder } = combatState;
    
    const livingCombatants = useMemo(() => 
        (initiativeOrder || [])
            .map(id => combatants.find(c => c.id === id && !c.isDead))
            .filter((c): c is Combatant => !!c)
    , [combatants, initiativeOrder]);

    if (livingCombatants.length === 0) {
        // Combat might be ending, don't render a broken tracker
        return null;
    }
    
    const currentTurnIndex = turn % livingCombatants.length;
    const currentCombatant = livingCombatants[currentTurnIndex];
    
    // Create an array with the order of turns starting from the next combatant.
    const upcomingCombatants = [
        ...livingCombatants.slice(currentTurnIndex + 1),
        ...livingCombatants.slice(0, currentTurnIndex)
    ];

    const isPlayerTurn = currentCombatant?.id === 'player';

    return (
        <div className="flex-shrink-0 bg-red-900/40 p-3 rounded-lg border-2 border-red-700/60 mt-4 animate-fadeIn shadow-2xl shadow-red-950/50">
            <div className="flex justify-between items-center mb-3 px-1">
                <h3 className="text-xl font-bold font-garamond text-red-200 flex items-center gap-2"><Swords /> COMBATE ATIVO</h3>
                <span className="font-mono text-lg text-red-300">Round {round}</span>
            </div>

            {currentCombatant && (
                 <div className="space-y-3">
                     <p className="text-amber-300 font-semibold uppercase text-sm">Turno Atual</p>
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
                                isPlayer={combatant.id === 'player'}
                            />
                        ))}
                    </div>
                </div>
            )}

            {!isPlayerTurn && (
                <div className="mt-4 text-center">
                    <button
                        onClick={nextTurn}
                        className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-stone-100 font-bold transition-colors shadow-md"
                    >
                        Próximo Turno
                    </button>
                </div>
            )}
        </div>
    );
};

export default NewCombatTracker;
