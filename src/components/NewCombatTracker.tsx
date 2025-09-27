'use client';
import React, { useMemo, useState } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import CombatantCard from './CombatantCard';
import type { Combatant } from '../types';
import { Swords, ChevronDown } from 'lucide-react';
import { Loader2 } from 'lucide-react';


const NewCombatTracker: React.FC = () => {
    const { combatState, character, nextTurn, isLoading } = useGameStateContext();
    const [isExpanded, setIsExpanded] = useState(true);

    if (!combatState || !combatState.isActive || !character) {
        return null;
    }

    const { round, combatants, turn, initiativeOrder } = combatState;
    
    // Create a fully-realized list of combatants for rendering, merging player data.
    const allCombatants = useMemo(() => {
        if (!Array.isArray(combatants)) return [];

        const combatantMap = new Map(combatants.map(c => [c.id, c]));

        // Ensure player data is correctly merged into the combatant list
        if ((initiativeOrder || []).includes('player')) {
            const playerInCombat = combatantMap.get('player') || {};
            const playerCombatant: Combatant = {
                id: 'player',
                name: character.name,
                hp: character.hp.current,
                maxHp: character.hp.max,
                initiative: playerInCombat.initiative || 0,
                isDead: character.hp.current <= 0,
                armorClass: character.ac.value,
                conditions: character.conditions,
                // These are defaults and should be updated by the combatState if present
                hasMoved: playerInCombat.hasMoved || false,
                hasActed: playerInCombat.hasActed || false,
                actionPoints: playerInCombat.actionPoints !== undefined ? playerInCombat.actionPoints : 1,
                bonusActionPoints: playerInCombat.bonusActionPoints !== undefined ? playerInCombat.bonusActionPoints : 1,
                rollHistory: playerInCombat.rollHistory || [],
            };
            combatantMap.set('player', playerCombatant);
        }

        return Array.from(combatantMap.values());

    }, [combatants, character, initiativeOrder]);
    
    
    const livingCombatants = useMemo(() => {
        if (!Array.isArray(allCombatants)) return [];
        return (initiativeOrder || [])
            .map(id => allCombatants.find(c => c.id === id && !c.isDead))
            .filter((c): c is Combatant => !!c)
    }, [allCombatants, initiativeOrder]);
    
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
        <div className="flex-shrink-0 bg-red-950/40 backdrop-blur-sm p-3 rounded-lg border-2 border-red-800/80 mt-4 animate-fadeIn shadow-2xl shadow-red-950/50">
            <button 
                className="flex justify-between items-center w-full"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
            >
                <h3 className="text-xl font-bold font-garamond text-red-200 flex items-center gap-2"><Swords /> COMBATE ATIVO</h3>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-lg text-red-300">Round {round}</span>
                  <ChevronDown className={`h-6 w-6 text-red-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {isExpanded && (
                <div className="mt-4 animate-fadeIn" style={{ animationDuration: '300ms'}}>
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
                                onClick={() => nextTurn()}
                                disabled={isLoading}
                                className="w-full px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-stone-900 font-bold transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Próximo Turno' }
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NewCombatTracker;
