
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

    const getCombatantId = (entry: any): string => {
        if (!entry) return '';
        // If it's a string, it's a direct ID
        if (typeof entry === 'string') return entry;
        // If it's an object with an `id` property (from initiativeOrder)
        if (entry.id) return entry.id;
        // If it's a full combatant object
        if (entry.name && character && entry.name === character.name) return character.name;
        
        return entry.name || ''; // Fallback
    };
    
    const allCombatants = useMemo<Combatant[]>(() => {
        if (!combatState.isActive || !character) {
            return [];
        }

        const combatantMap = new Map<string, Combatant>();

        const playerCombatant: Combatant = {
            id: character.name,
            name: character.name,
            hp: { current: character.hp.current, max: character.hp.max },
            initiative: 0,
            isDead: character.hp.current <= 0,
            hasMoved: false,
            hasActed: false,
            actionPoints: 1,
            bonusActionPoints: 1,
            conditions: character.conditions.map(c => c.name),
            rollHistory: [],
            isPlayer: true,
            ac: character.ac.value,
        };
        combatantMap.set(playerCombatant.id, playerCombatant);
        
        (combatState.combatants || []).forEach(apiCombatant => {
            if (!apiCombatant || !apiCombatant.name) return;
            const isPlayerFromApi = apiCombatant.name === character.name;
            const id = getCombatantId(apiCombatant);
            if (!id) return;

            const existingCombatant = combatantMap.get(id);

            let currentHp = apiCombatant.hp as any;
            if (typeof apiCombatant.hp === 'object' && apiCombatant.hp !== null) {
                currentHp = (apiCombatant.hp as any).current;
            }

            let maxHp = apiCombatant.hp as any;
            if (typeof apiCombatant.hp === 'object' && apiCombatant.hp !== null) {
                maxHp = (apiCombatant.hp as any).max;
            }

            const mergedCombatant: Combatant = {
                ...(existingCombatant || {}),
                ...apiCombatant,
                id,
                isPlayer: isPlayerFromApi,
                hp: {
                    current: typeof currentHp === 'number' ? currentHp : (existingCombatant?.hp?.current || 1),
                    max: typeof maxHp === 'number' ? maxHp : (existingCombatant?.hp?.max || 1)
                },
                ac: apiCombatant.ac ?? (existingCombatant?.ac || 10),
                actionPoints: apiCombatant.actionPoints ?? (existingCombatant?.actionPoints || 1),
                bonusActionPoints: apiCombatant.bonusActionPoints ?? (existingCombatant?.bonusActionPoints || 1),
                isDead: apiCombatant.isDead ?? (currentHp !== undefined && currentHp <= 0),
            };
            
            combatantMap.set(id, mergedCombatant);
        });

        if (!combatantMap.has(character.name)) {
            combatantMap.set(character.name, playerCombatant);
        }

        const validCombatants = Array.from(combatantMap.values()).filter(c => c && c.id && c.name);
    
        if (!combatState.initiativeOrder || combatState.initiativeOrder.length === 0) {
             return validCombatants.sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));
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
    
    const currentCombatantIndex = turn % initiativeOrder.length;
    const currentCombatantId = getCombatantId(initiativeOrder[currentCombatantIndex]);
    const currentCombatant = allCombatants.find(c => getCombatantId(c) === currentCombatantId);
    
    const upcomingCombatants = [];
    if (allCombatants.length > 1) {
        for (let i = 1; i < allCombatants.length; i++) {
            const nextIndex = (currentCombatantIndex + i) % allCombatants.length;
            const nextCombatant = allCombatants[nextIndex];
            if (nextCombatant && !nextCombatant.isDead) {
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
                  { !isExpanded && currentCombatant && <CombatantHeaderInfo combatant={currentCombatant as Combatant} /> }
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
                                combatant={currentCombatant as Combatant}
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
                                            combatant={combatant as Combatant}
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

    