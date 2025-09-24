'use client';
import React from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import { Heart } from 'lucide-react';

const CombatTracker: React.FC = () => {
    const { combatState } = useGameStateContext();

    if (!combatState.isActive || combatState.combatants.length === 0) return null;

    const { round, combatants, turn } = combatState;
    const sortedCombatants = [...combatants].sort((a, b) => b.initiative - a.initiative);
    const currentTurnIndex = turn % sortedCombatants.length;
    
    return (
        <div className="flex-shrink-0 bg-red-900/40 p-3 rounded-lg border border-red-700/60 mt-4 animate-pulse-slow">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-bold font-garamond text-red-200">COMBATE ATIVO</h3>
                <span className="font-mono text-sm text-red-300">Round {round}</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
                {sortedCombatants.map((combatant, index) => {
                    const isCurrentTurn = index === currentTurnIndex;
                    return (
                        <div key={combatant.id} className={`p-2 rounded-md flex-shrink-0 w-32 transition-all duration-300 ${isCurrentTurn ? 'bg-amber-600/50 border-2 border-amber-400 transform scale-105' : 'bg-stone-800/60 border border-stone-700'}`}>
                            <p className={`font-bold truncate ${isCurrentTurn ? 'text-white' : 'text-stone-200'}`}>{combatant.name}</p>
                            <div className="flex items-center gap-1 text-xs text-stone-400">
                                <Heart className="h-3 w-3" />
                                <span>{combatant.hp ?? '?'} / {combatant.maxHp ?? '?'}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default CombatTracker;
