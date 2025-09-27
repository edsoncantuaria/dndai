'use client';
import React, { useState, useMemo } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import { translateCondition } from '../utils/translator';
import { Heart, Shield, Swords, User, Bot, Skull, History, PlusSquare, Zap } from 'lucide-react';
import type { Combatant } from '../types';

const statusColorMap: Record<string, string> = {
    'Stunned': 'bg-yellow-600/50 text-yellow-200',
    'Unconscious': 'bg-gray-700/50 text-gray-300',
    'Paralyzed': 'bg-purple-600/50 text-purple-200',
    'Restrained': 'bg-orange-600/50 text-orange-200',
    'Poisoned': 'bg-green-700/50 text-green-300',
    'Frightened': 'bg-indigo-600/50 text-indigo-200',
};

const RollHistoryDisplay: React.FC<{ rollHistory: Combatant['rollHistory'] }> = ({ rollHistory }) => {
    if (!rollHistory || rollHistory.length === 0) {
        return <p className="text-xs italic text-stone-500">Nenhuma rolagem registrada.</p>;
    }
    return (
        <div className="space-y-1">
            {rollHistory.slice(-5).reverse().map((roll, index) => (
                <div key={index} className="text-xs text-stone-400">
                    <span className="font-semibold">{roll.type.toUpperCase()}:</span> {roll.total} <span className="text-stone-500">({roll.rolls.join(', ')})</span>
                </div>
            ))}
        </div>
    );
};

const CombatantCard: React.FC<{ combatant: Combatant; isCurrentTurn: boolean; isPlayer: boolean }> = ({ combatant, isCurrentTurn, isPlayer }) => {
    const [showHistory, setShowHistory] = useState(false);

    if (combatant.isDead) {
        return (
            <div className={`flex items-center justify-between p-2 rounded-md bg-stone-900/70 border border-stone-800 opacity-60`}>
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-black rounded-full"><Skull className="h-5 w-5 text-stone-500" /></div>
                    <span className="font-semibold text-stone-500 line-through">{combatant.name}</span>
                </div>
                <span className="text-sm font-bold text-red-500">DERROTADO</span>
            </div>
        );
    }
    
    const borderColor = isCurrentTurn ? 'border-amber-400 shadow-lg shadow-amber-900/50' : isPlayer ? 'border-blue-500/70' : 'border-stone-700';

    return (
        <div className={`p-2.5 rounded-lg border-2 transition-all duration-300 ${borderColor} ${isCurrentTurn ? 'bg-stone-700/50' : 'bg-stone-800/50'}`}>
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                     <div className={`p-2 rounded-full ${isCurrentTurn ? 'bg-amber-800' : 'bg-stone-900'}`}>{isPlayer ? <User className="h-5 w-5 text-blue-300"/> : <Bot className="h-5 w-5 text-red-300"/>}</div>
                    <div>
                        <h4 className={`font-bold text-lg ${isCurrentTurn ? 'text-white' : 'text-stone-200'}`}>{combatant.name}</h4>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {combatant.conditions?.map((cond, i) => (
                                <span key={i} className={`px-1.5 py-0.5 text-xs font-semibold rounded-full ${statusColorMap[cond.name] || 'bg-stone-600/50 text-stone-300'}`}>
                                    {translateCondition(cond.name)}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowHistory(!showHistory)} className="text-stone-400 hover:text-white" title="Histórico de Rolagens">
                        <History className="h-4 w-4" />
                    </button>
                    <div className="text-center">
                        <div className="text-xs text-stone-400 flex items-center gap-1"><Shield className="h-3 w-3"/>AC</div>
                        <div className="font-bold text-stone-200">{combatant.armorClass ?? '?'}</div>
                    </div>
                </div>
            </div>
            
            {showHistory && (
                <div className="mt-2 p-2 bg-stone-950/50 rounded-md">
                    <h6 className="text-xs font-bold text-stone-400 mb-1">ÚLTIMAS ROLAGENS</h6>
                    <RollHistoryDisplay rollHistory={combatant.rollHistory} />
                </div>
            )}
            
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="bg-stone-900/50 p-1.5 rounded-md">
                    <div className="text-xs text-red-400 flex items-center justify-center gap-1"><Heart className="h-3 w-3"/> HP</div>
                    <div className="font-mono text-lg font-bold text-red-300">{combatant.hp ?? '?'} / {combatant.maxHp ?? '?'}</div>
                </div>
                <div className="bg-stone-900/50 p-1.5 rounded-md">
                    <div className="text-xs text-sky-400 flex items-center justify-center gap-1"><Zap className="h-3 w-3"/> Ação</div>
                    <div className="font-mono text-lg font-bold text-sky-300">{combatant.actionPoints}</div>
                </div>
                 <div className="bg-stone-900/50 p-1.5 rounded-md">
                    <div className="text-xs text-lime-400 flex items-center justify-center gap-1"><PlusSquare className="h-3 w-3"/> Bônus</div>
                    <div className="font-mono text-lg font-bold text-lime-300">{combatant.bonusActionPoints}</div>
                </div>
            </div>
        </div>
    );
};

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
