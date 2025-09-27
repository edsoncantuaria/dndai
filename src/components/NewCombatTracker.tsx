'use client';
import React, { useMemo, useState } from 'react';
import { useGameStateContext } from '../contexts/GameStateContext';
import CombatantCard from './CombatantCard';
import type { Combatant } from '../types';
import { Swords, ChevronDown, Heart, Shield, Loader2 } from 'lucide-react';
import { translateCondition } from '@/utils/translator';


const CombatantHeaderInfo: React.FC<{ combatant: Combatant }> = ({ combatant }) => {
    if (!combatant) return null;

    const currentHp = typeof combatant.hp === 'number' ? combatant.hp : '?';
    const maxHp = typeof combatant.maxHp === 'number' ? combatant.maxHp : '?';

    return (
        <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="text-stone-300 font-bold">{combatant.name}</span>
            <div className="flex items-center gap-1.5 text-red-300">
                <Heart className="h-4 w-4" />
                <span>{currentHp} / {maxHp}</span>
            </div>
            <div className="flex items-center gap-1.5 text-blue-300">
                <Shield className="h-4 w-4" />
                <span>CA {combatant.armorClass ?? '?'}</span>
            </div>
            {combatant.conditions && combatant.conditions.length > 0 && (
                 <div className="flex items-center gap-1.5 text-yellow-300">
                    {combatant.conditions.map(c => <span key={c.index} title={translateCondition(c.name)}>⚠️</span>)}
                </div>
            )}
        </div>
    )
}


const NewCombatTracker: React.FC = () => {
    const { combatState, character, nextTurn, isLoading } = useGameStateContext();
    const [isExpanded, setIsExpanded] = useState(true);

    const allCombatants = useMemo<Combatant[]>(() => {
        if (!combatState || !Array.isArray(combatState.combatants) || !character) return [];

        const combatantMap = new Map<string, Combatant>();

        // Add all NPCs to the map
        combatState.combatants.forEach(c => {
            if (c.id !== 'player') {
                combatantMap.set(c.id, {
                    ...c,
                    hp: c.hp,
                    maxHp: c.maxHp,
                    armorClass: c.armorClass
                });
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
            initiative: playerInCombat.initiative || 0,
            initiativeRoll: playerInCombat.initiativeRoll,
            isDead: character.hp.current <= 0,
            hasMoved: playerInCombat.hasMoved || false,
            hasActed: playerInCombat.hasActed || false,
            actionPoints: playerInCombat.actionPoints !== undefined ? playerInCombat.actionPoints : 1,
            bonusActionPoints: playerInCombat.bonusActionPoints !== undefined ? playerInCombat.bonusActionPoints : 1,
            conditions: character.conditions,
            rollHistory: playerInCombat.rollHistory || [],
        };
        combatantMap.set('player', playerCombatant);

        // Use initiativeOrder to sort and return the final array
        if (!combatState.initiativeOrder) {
            return Array.from(combatantMap.values()).sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));
        }

        return combatState.initiativeOrder
            .map(id => combatantMap.get(id))
            .filter((c): c is Combatant => !!c);

    }, [combatState, character]);

    if (!combatState || !combatState.isActive) {
        return null;
    }
    
    const { round, turn, initiativeOrder } = combatState;
    if (!initiativeOrder || initiativeOrder.length === 0 || allCombatants.length === 0) return null;

    const currentCombatantId = initiativeOrder[turn % initiativeOrder.length];
    const currentCombatant = allCombatants.find(c => c.id === currentCombatantId);
    
    const upcomingCombatants = initiativeOrder
        .slice(1)
        .map(id => allCombatants.find(c => c.id === id))
        .filter((c): c is Combatant => !!c && !c.isDead);

    const isPlayerTurn = currentCombatant?.id === 'player';

    return (
        <div className="flex-shrink-0 bg-red-950/40 backdrop-blur-sm p-3 rounded-lg border-2 border-red-800/80 mt-4 animate-fadeIn shadow-2xl shadow-red-950/50">
            <div 
                className="flex justify-between items-center w-full"
            >
                <h3 className="text-xl font-bold font-garamond text-red-200 flex items-center gap-2">
                    <Swords /> 
                    <span>COMBATE ATIVO</span>
                </h3>

                <div className="flex items-center gap-4">
                  { !isExpanded && currentCombatant && <CombatantHeaderInfo combatant={currentCombatant} /> }
                  <span className="font-mono text-lg text-red-300">Round {round}</span>
                  <button 
                    onClick={() => setIsExpanded(!isExpanded)}
                    aria-expanded={isExpanded}
                    className="text-red-300 hover:text-white"
                  >
                    <ChevronDown className={`h-6 w-6 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                </div>
            </div>

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
