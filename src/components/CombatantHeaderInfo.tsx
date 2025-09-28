'use client';
import React from 'react';
import type { Combatant } from '../types';
import { translateCondition } from '../utils/translator';
import { Heart, Shield } from 'lucide-react';


const CombatantHeaderInfo: React.FC<{ combatant: Combatant }> = ({ combatant }) => {
    if (!combatant) return null;

    const currentHp = typeof combatant.hp === 'number' ? combatant.hp : '?';
    const maxHp = typeof combatant.maxHp === 'number' ? combatant.maxHp : '?';
    const advantage = combatant.tempModifiers?.advantage;
    const disadvantage = combatant.tempModifiers?.disadvantage;

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
                 <div className="flex items-center gap-1.5 text-yellow-300" title={combatant.conditions.map(c => translateCondition(c.name)).join(', ')}>
                    <span>⚠️</span>
                </div>
            )}
             {advantage && <span className="text-green-400" title="Vantagem">▲</span>}
             {disadvantage && <span className="text-red-400" title="Desvantagem">▼</span>}
        </div>
    )
}

export default CombatantHeaderInfo;
