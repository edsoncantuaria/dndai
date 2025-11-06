'use client';
import React from 'react';
import type { Combatant } from '../types';
import { Heart, Shield, Zap } from 'lucide-react';

type Attitude = NonNullable<Combatant['attitude']>;

const attitudeLabels: Record<Attitude, string> = {
    ally: 'Aliado',
    neutral: 'Neutro',
    hostile: 'Hostil',
};

const attitudeColors: Record<Attitude, string> = {
    ally: 'bg-emerald-900/40 text-emerald-200 border border-emerald-700/60',
    neutral: 'bg-slate-900/40 text-slate-200 border border-slate-700/60',
    hostile: 'bg-red-900/40 text-red-200 border border-red-700/60',
};

const CombatantHeaderInfo: React.FC<{ combatant: Combatant }> = ({ combatant }) => {
    if (!combatant) return null;

    const currentHp = typeof combatant.hp === 'object' ? combatant.hp.current : (typeof combatant.hp === 'number' ? combatant.hp : '?');
    const maxHp = typeof combatant.hp === 'object' ? combatant.hp.max : combatant.maxHp ?? '';
    const actionPoints = combatant.actionPoints ?? 0;

    const advantage = combatant.tempModifiers?.advantage;
    const disadvantage = combatant.tempModifiers?.disadvantage;
    const attitude: Attitude = combatant.attitude ?? (combatant.isPlayer ? 'ally' : 'hostile');

    return (
        <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="text-stone-300 font-bold">{combatant.name}</span>
            <span className={`px-2 py-0.5 rounded-full uppercase tracking-wide ${attitudeColors[attitude]}`}>
                {attitudeLabels[attitude]}
            </span>
            <div className="flex items-center gap-1.5 text-red-300">
                <Heart className="h-4 w-4" />
                <span>{currentHp}{maxHp ? ` / ${maxHp}` : ''}</span>
            </div>
            <div className="flex items-center gap-1.5 text-blue-300">
                <Shield className="h-4 w-4" />
                <span>CA {combatant.ac ?? '?'}</span>
            </div>
            <div className="flex items-center gap-1 text-sky-300">
                <Zap className="h-4 w-4" />
                <span>{actionPoints}/30 AP</span>
            </div>
            {combatant.conditions && combatant.conditions.length > 0 && (
                 <div className="flex items-center gap-1.5 text-yellow-300" title={combatant.conditions.join(', ')}>
                    <span>⚠️</span>
                </div>
            )}
             {advantage && <span className="text-green-400" title="Vantagem">▲</span>}
             {disadvantage && <span className="text-red-400" title="Desvantagem">▼</span>}
        </div>
    )
}

export default CombatantHeaderInfo;
