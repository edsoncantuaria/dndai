'use client';
import React, { useMemo } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import CombatantCard from './CombatantCard';
import type { Combatant } from '../types';
import { Swords } from 'lucide-react';


const NewCombatTracker: React.FC = () => {
    const { combatState, nextTurn } = useGameStateContext();

    // Fix: Add a guard clause to ensure combatState and combatants are defined
    if (!combatState || !combatState.isActive || !combatState.combatants || combatState.combatants.length === 0) {
        return null;
    }

    const { round, combatants, turn, initiativeOrder } = combatState;
    
    // Filtra combatentes vivos e os ordena pela ordem de iniciativa.
    const sortedLivingCombatants = useMemo(() => {
        const livingCombatantsMap = new Map(combatants.filter(c => !c.isDead).map(c => [c.id, c]));
        if (!initiativeOrder || initiativeOrder.length === 0) {
            // Fallback para a ordem do array se initiativeOrder não estiver definido.
            return Array.from(livingCombatantsMap.values());
        }
        return initiativeOrder
            .map(id => livingCombatantsMap.get(id))
            .filter((c): c is Combatant => !!c);
    }, [combatants, initiativeOrder]);
    
    // Determina o índice atual na lista de combatentes vivos.
    const currentTurnIndex = sortedLivingCombatants.findIndex(c => c.id === initiativeOrder?.[turn]);

    if (currentTurnIndex === -1 && sortedLivingCombatants.length > 0) {
        // Se o combatente do turno atual não está mais na lista (ex: morreu), o tracker pode ficar dessincronizado.
        // Uma solução simples é não renderizar nada até o próximo avanço de turno corrigir o índice.
        // Uma solução mais complexa seria avançar o turno automaticamente.
        // Por enquanto, apenas evitamos o erro.
        return (
             <div className="flex-shrink-0 bg-red-900/40 p-3 rounded-lg border-2 border-red-700/60 mt-4 animate-fadeIn shadow-2xl shadow-red-950/50">
                 <p className="text-center text-amber-300">Atualizando ordem de combate...</p>
             </div>
        );
    }
    
    const currentCombatant = sortedLivingCombatants[currentTurnIndex];
    // Cria um array com a ordem de turnos começando pelo próximo.
    const upcomingCombatants = [
        ...sortedLivingCombatants.slice(currentTurnIndex + 1),
        ...sortedLivingCombatants.slice(0, currentTurnIndex)
    ];


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
                        isPlayer={currentCombatant.id === 'player'}
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
