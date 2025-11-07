// src/components/GameHud.tsx
'use client';

import React, { useMemo } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { Shield, Heart, Zap, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const timeOfDayGradients: Record<string, string> = {
    'manhã': 'from-amber-300/30 via-yellow-200/10 to-transparent',
    'tarde': 'from-orange-400/30 via-amber-300/10 to-transparent',
    'noite': 'from-indigo-700/40 via-purple-700/10 to-transparent',
};

const GameHud: React.FC = () => {
    const { character, combatState } = useGameStateContext();

    const playerCombatant = useMemo(() => {
        if (!combatState?.isActive) return null;
        const playerId = character?.id?.toString();
        return combatState.combatants.find(c => c.isPlayer || c.id === 'player' || c.id === playerId);
    }, [combatState, character]);

    if (!character || !combatState?.isActive) return null;

    const hpPercent = character.hp?.max ? Math.max(0, Math.min(100, (character.hp.current / character.hp.max) * 100)) : 0;
    const xpPercent = character.xpToNextLevel ? Math.max(0, Math.min(100, (character.xp / character.xpToNextLevel) * 100)) : 0;
    const apValue = playerCombatant?.actionPoints ?? '--';
    const apPercent = typeof apValue === 'number' ? Math.max(0, Math.min(100, (apValue / 30) * 100)) : 0;

    const timeGradient = timeOfDayGradients[(character.worldState?.timeOfDay || '').toLowerCase()] ?? 'from-amber-200/10 via-stone-800/20 to-transparent';

    const hudItems = [
        {
            label: 'Vida',
            icon: <Heart className="h-4 w-4 text-rose-300" />,
            value: `${character.hp.current} / ${character.hp.max}`,
            percent: hpPercent,
            barClass: 'bg-gradient-to-r from-rose-500 via-rose-400 to-amber-300',
        },
        {
            label: 'CA',
            icon: <Shield className="h-4 w-4 text-blue-200" />,
            value: character.ac?.value ?? '--',
            percent: character.ac?.value ? Math.min(100, (character.ac.value / 30) * 100) : 0,
            barClass: 'bg-gradient-to-r from-sky-500 via-sky-400 to-cyan-300',
        },
        {
            label: 'AP',
            icon: <Zap className="h-4 w-4 text-amber-200" />,
            value: apValue,
            percent: apPercent,
            barClass: 'bg-gradient-to-r from-amber-500 via-yellow-400 to-lime-300',
        },
        {
            label: `XP (Lvl ${character.level})`,
            icon: <Star className="h-4 w-4 text-emerald-200" />,
            value: `${character.xp} / ${character.xpToNextLevel}`,
            percent: xpPercent,
            barClass: 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-300',
        },
    ];

    return (
        <div className={cn(
            'relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 flex flex-wrap gap-4 shadow-lg overflow-hidden'
        )}>
            <div className={cn('absolute inset-0 pointer-events-none bg-gradient-to-r opacity-70', timeGradient)} />
            {hudItems.map((item, index) => (
                <div key={item.label} className="relative flex-1 min-w-[160px] z-10">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
                        {item.icon}
                        {item.label}
                    </div>
                    <div className="mt-1 text-lg font-bold text-stone-100">{item.value}</div>
                    <div className="mt-2 h-2.5 rounded-full bg-stone-800 overflow-hidden border border-stone-700">
                        <div
                            className={cn('h-full rounded-full transition-all duration-700 ease-out', item.barClass)}
                            style={{ width: `${item.percent}%` }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default GameHud;
