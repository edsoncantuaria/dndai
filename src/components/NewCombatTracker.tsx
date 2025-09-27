'use client';
import React, { useMemo } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import CombatantCard from './CombatantCard';
import type { Combatant } from '../types';
import { Swords } from 'lucide-react';


const NewCombatTracker: React.FC = () => {
    const { combatState, character, nextTurn, isLoading } = useGameStateContext();

    if (!combatState || !combatState.isActive || !character) {
        return null;
    }

    const { round, combatants, turn, initiativeOrder } = combatState;
    
    const playerCombatant: Combatant | null = useMemo(() => character ? {
        id: 'player',
        name: character.name,
        hp: character.hp.current,
        maxHp: character.hp.max,
        initiative: 0, 
        isDead: character.hp.current <= 0,
        hasMoved: false,
        hasActed: false,
        actionPoints: 1,
        bonusActionPoints: 1,
        rollHistory: [],
        armorClass: character.ac.value,
        conditions: character.conditions
    } : null, [character]);

    const allCombatants = useMemo(() => {
        const combatantMap = new Map((combatants || []).map(c => [c.id, c]));
        if (playerCombatant && (initiativeOrder || []).includes('player')) {
            const playerCombatData = combatantMap.get('player') || {};
            combatantMap.set('player', { ...playerCombatant, ...playerCombatData, id: 'player' });
        }
        return Array.from(combatantMap.values());
    }, [combatants, playerCombatant, initiativeOrder]);
    
    const livingCombatants = useMemo(() => 
        (initiativeOrder || [])
            .map(id => allCombatants.find(c => c.id === id && !c.isDead))
            .filter((c): c is Combatant => !!c)
    , [allCombatants, initiativeOrder]);
    
    if (livingCombatants.length === 0 && combatants.length > 0) {
        return null;
    }
    
    const currentCombatantId = initiativeOrder && initiativeOrder.length > turn ? initiativeOrder[turn] : null;
    const currentCombatant = currentCombatantId ? allCombatants.find(c => c.id === currentCombatantId) : null;
    
    const upcomingCombatants = useMemo(() => {
        if (!initiativeOrder || !currentCombatantId) return [];
        const currentIndex = initiativeOrder.indexOf(currentCombatantId);
        if (currentIndex === -1) return [];

        const orderedIds = [...initiativeOrder.slice(currentIndex + 1), ...initiativeOrder.slice(0, currentIndex)];
        return orderedIds.map(id => allCombatants.find(c => c.id === id)).filter((c): c is Combatant => !!c && !c.isDead);
    }, [allCombatants, initiativeOrder, currentCombatantId]);

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
                        disabled={isLoading}
                        className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-stone-100 font-bold transition-colors shadow-md disabled:opacity-50"
                    >
                        Próximo Turno
                    </button>
                </div>
            )}
        </div>
    );
};

export default NewCombatTracker;
