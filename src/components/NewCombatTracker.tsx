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

        // Add all NPCs to the map
        combatState.combatants.forEach(c => {
            if (c.id !== 'player') {
                combatantMap.set(c.id, c);
            }
        });
        
        // Add or update player data
        const playerInCombat = combatState.combatants.find(c => c.id === 'player') || {};
        const playerCombatant: Combatant = {
            id: 'player',
            name: character.name,
            hp: character.hp.current,
            maxHp: character.hp.max,
            armorClass: character.ac.value,
            initiative: playerInCombat.initiative ?? -1,
            initiativeRoll: playerInCombat.initiativeRoll,
            isDead: character.hp.current <= 0,
            hasMoved: playerInCombat.hasMoved || false,
            hasActed: playerInCombat.hasActed || false,
            actionPoints: playerInCombat.actionPoints !== undefined ? playerInCombat.actionPoints : 1,
            bonusActionPoints: playerInCombat.bonusActionPoints !== undefined ? playerInCombat.bonusActionPoints : 1,
            conditions: character.conditions,
            rollHistory: playerInCombat.rollHistory || [],
            tempModifiers: playerInCombat.tempModifiers || {},
        };
        combatantMap.set('player', playerCombatant);
        
        if (!combatState.initiativeOrder || combatState.initiativeOrder.length === 0) {
            // Fallback sort if initiativeOrder is missing
            return Array.from(combatantMap.values()).sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));
        }

        // Main logic: sort based on the initiativeOrder array
        return combatState.initiativeOrder
            .map(id => combatantMap.get(id))
            .filter((c): c is Combatant => !!c);

    }, [combatState, character]);

    if (!combatState.isActive || allCombatants.length === 0) {
        return null;
    }
    
    const { round, turn, initiativeOrder } = combatState;
    if (!initiativeOrder || initiativeOrder.length === 0) return null;

    const currentCombatantId = initiativeOrder[turn % initiativeOrder.length];
    const currentCombatant = allCombatants.find(c => c.id === currentCombatantId);
    
    const upcomingCombatants = Array.from({ length: initiativeOrder.length -1 }, (_, i) => {
        const nextIndex = (turn + 1 + i) % initiativeOrder.length;
        return allCombatants.find(c => c.id === initiativeOrder[nextIndex]);
    }).filter((c): c is Combatant => !!c && !c.isDead);

    const isPlayerTurn = currentCombatant?.id === 'player';

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
                                        isPlayer={combatant.id === 'player'}
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
