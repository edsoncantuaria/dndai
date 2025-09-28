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
        if (!combatState.isActive || !character) {
            return [];
        }

        const combatantMap = new Map<string, Combatant>();

        // Create player combatant from the main character state. This is the source of truth.
        const playerCombatant: Combatant = {
            id: character.name, // Use the character name as a reliable ID for the player
            name: character.name,
            hp: character.hp.current,
            maxHp: character.hp.max,
            initiative: 0, // Will be updated by API data
            isDead: character.hp.current <= 0,
            hasMoved: false, // State managed by AI
            hasActed: false, // State managed by AI
            actionPoints: 1, // Default, will be updated
            bonusActionPoints: 1, // Default, will be updated
            conditions: character.conditions,
            rollHistory: [],
            isPlayer: true,
            armorClass: character.ac.value,
        };
        combatantMap.set(playerCombatant.id, playerCombatant);
        
        // Process combatants from the API, merging with player data
        (combatState.combatants || []).forEach(apiCombatant => {
            if (!apiCombatant || !apiCombatant.name) return;
            const isPlayerFromApi = apiCombatant.name === character.name;
            const id = isPlayerFromApi ? character.name : apiCombatant.id;

            const existingCombatant = combatantMap.get(id);

            // Safely get HP values, handling both {current, max} and direct number formats
            let currentHp = apiCombatant.hp;
            if (typeof apiCombatant.hp === 'object' && apiCombatant.hp !== null) {
                currentHp = (apiCombatant.hp as any).current;
            }

            let maxHp = apiCombatant.maxHp;
            if (typeof apiCombatant.hp === 'object' && apiCombatant.hp !== null) {
                maxHp = (apiCombatant.hp as any).max;
            }


            const mergedCombatant: Combatant = {
                ...existingCombatant, // Start with base (player) or empty object
                ...apiCombatant, // Apply API data
                id, // Ensure consistent ID
                isPlayer: isPlayerFromApi,
                hp: typeof currentHp === 'number' ? currentHp : (existingCombatant?.hp || 1),
                maxHp: typeof maxHp === 'number' ? maxHp : (existingCombatant?.maxHp || 1),
                armorClass: apiCombatant.armorClass ?? (existingCombatant?.armorClass || 10),
                actionPoints: apiCombatant.actionPoints ?? (existingCombatant?.actionPoints || 1),
                bonusActionPoints: apiCombatant.bonusActionPoints ?? (existingCombatant?.bonusActionPoints || 1),
                isDead: apiCombatant.isDead ?? (currentHp !== undefined && currentHp <= 0),
            };
            
            combatantMap.set(id, mergedCombatant);
        });

        // Ensure the player is always in the list if combat is active
        if (!combatantMap.has(character.name)) {
            combatantMap.set(character.name, playerCombatant);
        }

        const validCombatants = Array.from(combatantMap.values()).filter(c => c && c.id && c.name);

        if (!combatState.initiativeOrder || combatState.initiativeOrder.length === 0) {
             return validCombatants.sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));
        }
    
        const getCombatantId = (entry: any): string => {
            if (typeof entry === 'string') return entry;
            if (entry.id.toLowerCase().includes('player') || entry.name === character.name) return character.name;
            return entry.id;
        }

        return combatState.initiativeOrder
            .map(orderEntry => {
                const id = getCombatantId(orderEntry);
                return combatantMap.get(id);
            })
            .filter((c): c is Combatant => c !== undefined);

    }, [combatState, character]);

    if (!combatState.isActive || allCombatants.length === 0) {
        return null;
    }
    
    const { round, turn, initiativeOrder } = combatState;
    if (!initiativeOrder || initiativeOrder.length === 0) return null;
    
    const getCombatantId = (entry: any): string => {
        if (typeof entry === 'string') return entry;
        if (entry.id.toLowerCase().includes('player') || entry.name === character!.name) return character!.name;
        return entry.id;
    }
    
    const currentCombatantIndex = turn % initiativeOrder.length;
    const currentCombatantId = getCombatantId(initiativeOrder[currentCombatantIndex]);
    const currentCombatant = allCombatants.find(c => c.id === currentCombatantId);
    
    const upcomingCombatants = [];
    if (allCombatants.length > 1) {
        for (let i = 1; i < allCombatants.length; i++) {
            const nextIndex = (currentCombatantIndex + i) % allCombatants.length;
            const nextCombatant = allCombatants[nextIndex];
            if (nextCombatant && !nextCombatant.isDead) { // Filter out defeated combatants from upcoming list
                upcomingCombatants.push(nextCombatant);
            }
        }
    }

    const isPlayerTurn = currentCombatant?.isPlayer || false;

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
                                isPlayer={!!currentCombatant.isPlayer}
                            />
                        </div>
                    )}
                    
                    {upcomingCombatants.length > 0 && (
                        <div className="mt-4 space-y-2">
                            <p className="text-stone-300 font-semibold uppercase text-sm">Próximos</p>
                            <div className="space-y-3 opacity-80">
                                {upcomingCombatants.map((combatant) => (
                                    combatant ? (
                                        <CombatantCard
                                            key={combatant.id}
                                            combatant={combatant}
                                            isCurrentTurn={false}
                                            isPlayer={!!combatant.isPlayer}
                                        />
                                    ) : null
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
