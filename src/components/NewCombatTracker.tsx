'use client';
import React, { useMemo } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import CombatantCard from './CombatantCard';
import type { Combatant } from '../types';
import { Swords } from 'lucide-react';


const NewCombatTracker: React.FC = () => {
    const { combatState, nextTurn } = useGameStateContext();

    if (!combatState.isActive || combatState.combatants.length === 0) {
        return null;
    }

    const { round, combatants, turn, initiativeOrder } = combatState;
    
    const sortedCombatants = useMemo(() => {
        const livingCombatants = combatants.filter(c => !c.isDead);
        if (!initiativeOrder || initiativeOrder.length === 0) {
            return livingCombatants.sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));
        }
        return initiativeOrder
            .map(id => livingCombatants.find(c => c.id === id))
            .filter((c): c is Combatant => !!c);
    }, [combatants, initiativeOrder]);
    
    const currentTurnIndex = turn % sortedCombatants.length;
    const currentCombatant = sortedCombatants[currentTurnIndex];
    const nextCombatant = sortedCombatants[(currentTurnIndex + 1) % sortedCombatants.length];


    return (
        <div className="flex-shrink-0 bg-red-900/40 p-3 rounded-lg border-2 border-red-700/60 mt-4 animate-fadeIn shadow-2xl shadow-red-950/50">
            <div className="flex justify-between items-center mb-3 px-1">
                <h3 className="text-xl font-bold font-garamond text-red-200 flex items-center gap-2"><Swords /> COMBATE ATIVO</h3>
                <span className="font-mono text-lg text-red-300">Round {round}</span>
            </div>

            <div className="mb-2 text-amber-300 font-semibold">
              Turno: {currentCombatant?.name}
            </div>
            <div className="mb-3 text-stone-400 text-sm">
              Próximo: {nextCombatant?.name}
            </div>

            <div className="space-y-3">
                {sortedCombatants.map((combatant, index) => (
                    <CombatantCard
                        key={combatant.id}
                        combatant={combatant}
                        isCurrentTurn={index === currentTurnIndex}
                        isPlayer={combatant.id === 'player'}
                    />
                ))}
            </div>

            <div className="mt-4 text-center">
                <button
                    onClick={nextTurn}
                    className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-stone-100 font-bold transition-colors shadow-md"
                >
                    Próximo Turno
                </button>
            </div>
        </div>
    );
};

export default NewCombatTracker;
