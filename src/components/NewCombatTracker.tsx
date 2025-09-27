'use client';
import React, { useMemo } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import CombatantCard from './CombatantCard';
import type { Combatant } from '../types';
import { Swords } from 'lucide-react';


const NewCombatTracker: React.FC = () => {
    const { combatState, character } = useGameStateContext();

    if (!combatState.isActive || combatState.combatants.length === 0) {
        return null;
    }

    const { round, combatants, turn } = combatState;
    // Use `initiativeOrder` se disponível, caso contrário, ordene por iniciativa. Isso mantém a ordem estável.
    const sortedCombatants = useMemo(() => {
        if (combatState.initiativeOrder && combatState.initiativeOrder.length > 0) {
            return combatState.initiativeOrder.map(id => combatants.find(c => c.id === id)).filter((c): c is Combatant => !!c);
        }
        return [...combatants].sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));
    }, [combatants, combatState.initiativeOrder]);
    
    const currentTurnIndex = turn % sortedCombatants.length;

    return (
        <div className="flex-shrink-0 bg-red-900/40 p-3 rounded-lg border-2 border-red-700/60 mt-4 animate-fadeIn shadow-2xl shadow-red-950/50">
            <div className="flex justify-between items-center mb-3 px-1">
                <h3 className="text-xl font-bold font-garamond text-red-200 flex items-center gap-2"><Swords /> COMBATE ATIVO</h3>
                <span className="font-mono text-lg text-red-300">Round {round}</span>
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
        </div>
    );
};

export default NewCombatTracker;
