// src/components/GameHud.tsx
'use client';

import React, { useMemo } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { Shield, Heart, Zap, Star, DoorOpen, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const timeOfDayGradients: Record<string, string> = {
    'manhã': 'from-amber-300/30 via-yellow-200/10 to-transparent',
    'tarde': 'from-orange-400/30 via-amber-300/10 to-transparent',
    'noite': 'from-indigo-700/40 via-purple-700/10 to-transparent',
};

const StatBar: React.FC<{
    label: string;
    icon: React.ReactNode;
    value: string | number;
    percent: number;
    barClass: string;
}> = ({ label, icon, value, percent, barClass }) => (
    <div className="relative flex-1 min-w-[140px] z-10">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
            {icon}
            {label}
        </div>
        <div className="mt-1 text-lg font-bold text-stone-100">{value}</div>
        <div className="mt-2 h-2.5 rounded-full bg-stone-800 overflow-hidden border border-stone-700">
            <div
                className={cn('h-full rounded-full transition-all duration-700 ease-out', barClass)}
                style={{ width: `${percent}%` }}
            />
        </div>
    </div>
);

const CompactStat: React.FC<{
    label: string;
    icon: React.ReactNode;
    value: string | number;
}> = ({ label, icon, value }) => (
    <div className="flex items-center gap-2">
        <div className="rounded-full bg-stone-900/50 border border-stone-700/80 p-2">
            {icon}
        </div>
        <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</div>
            <div className="text-base font-bold text-stone-100">{value}</div>
        </div>
    </div>
);


const GameHud: React.FC = () => {
    const { character, combatState } = useGameStateContext();
    const { logout } = useAuth();

    const playerCombatant = useMemo(() => {
        if (!combatState?.isActive) return null;
        return combatState.combatants.find(c => c.isPlayer);
    }, [combatState]);

    if (!character || !combatState?.isActive) return null;

    const currentHp = playerCombatant?.hp?.current ?? character.hp.current;
    const maxHp = playerCombatant?.hp?.max ?? character.hp.max;
    const currentAc = playerCombatant?.ac ?? character.ac.value;
    const currentAp = playerCombatant?.actionPoints ?? 0;
    
    const hpPercent = maxHp > 0 ? Math.max(0, Math.min(100, (currentHp / maxHp) * 100)) : 0;
    const xpPercent = character.xpToNextLevel > 0 ? Math.max(0, Math.min(100, (character.xp / character.xpToNextLevel) * 100)) : 0;
    
    const timeGradient = timeOfDayGradients[(character.worldState?.timeOfDay || '').toLowerCase()] ?? 'from-amber-200/10 via-stone-800/20 to-transparent';

    return (
        <div className={cn(
            'relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-3 shadow-lg overflow-hidden'
        )}>
            <div className={cn('absolute inset-0 pointer-events-none bg-gradient-to-r opacity-70', timeGradient)} />
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
                
                <StatBar 
                    label="Vida"
                    icon={<Heart className="h-4 w-4 text-rose-300" />}
                    value={`${currentHp} / ${maxHp}`}
                    percent={hpPercent}
                    barClass="bg-gradient-to-r from-rose-500 via-rose-400 to-amber-300"
                />

                <div className="flex flex-shrink-0 items-center gap-3">
                    <CompactStat 
                        label="CA"
                        icon={<Shield className="h-4 w-4 text-blue-200" />}
                        value={currentAc}
                    />
                    <CompactStat
                        label="AP"
                        icon={<Zap className="h-4 w-4 text-amber-200" />}
                        value={`${currentAp}/30`}
                    />
                </div>

                <StatBar 
                    label={`XP (Lvl ${character.level})`}
                    icon={<Star className="h-4 w-4 text-emerald-200" />}
                    value={`${character.xp} / ${character.xpToNextLevel}`}
                    percent={xpPercent}
                    barClass="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-300"
                />

            </div>
        </div>
    );
};

export default GameHud;
