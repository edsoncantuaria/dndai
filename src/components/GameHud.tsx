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

interface GameHudProps {
    onExitToMenu?: () => void;
}

const GameHud: React.FC<GameHudProps> = ({ onExitToMenu }) => {
    const { character, combatState } = useGameStateContext();
    const { logout } = useAuth();

    const playerCombatant = useMemo(() => {
        if (!combatState?.isActive) return null;
        // Identifica o combatente do jogador de forma mais robusta
        return combatState.combatants.find(c => c.isPlayer);
    }, [combatState]);

    if (!character || !combatState?.isActive) return null;

    // Prioriza os dados do combatState, com fallback para os dados gerais do personagem
    const currentHp = playerCombatant?.hp?.current ?? character.hp.current;
    const maxHp = playerCombatant?.hp?.max ?? character.hp.max;
    const currentAc = playerCombatant?.ac ?? character.ac.value;
    const currentAp = playerCombatant?.actionPoints ?? 0;
    
    const hpPercent = maxHp > 0 ? Math.max(0, Math.min(100, (currentHp / maxHp) * 100)) : 0;
    const xpPercent = character.xpToNextLevel > 0 ? Math.max(0, Math.min(100, (character.xp / character.xpToNextLevel) * 100)) : 0;
    const apPercent = Math.max(0, Math.min(100, (currentAp / 30) * 100));
    const acPercent = Math.min(100, (currentAc / 30) * 100);

    const timeGradient = timeOfDayGradients[(character.worldState?.timeOfDay || '').toLowerCase()] ?? 'from-amber-200/10 via-stone-800/20 to-transparent';

    const hudItems = [
        {
            label: 'Vida',
            icon: <Heart className="h-4 w-4 text-rose-300" />,
            value: `${currentHp} / ${maxHp}`,
            percent: hpPercent,
            barClass: 'bg-gradient-to-r from-rose-500 via-rose-400 to-amber-300',
        },
        {
            label: 'CA',
            icon: <Shield className="h-4 w-4 text-blue-200" />,
            value: currentAc,
            percent: acPercent,
            barClass: 'bg-gradient-to-r from-sky-500 via-sky-400 to-cyan-300',
        },
        {
            label: 'AP',
            icon: <Zap className="h-4 w-4 text-amber-200" />,
            value: currentAp,
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
            'relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm p-3 sm:p-4 flex flex-col gap-3 shadow-lg overflow-hidden'
        )}>
            <div className={cn('absolute inset-0 pointer-events-none bg-gradient-to-r opacity-70', timeGradient)} />
            <div className="relative z-10 flex flex-wrap gap-2 justify-end">
                {onExitToMenu && (
                    <button
                        onClick={onExitToMenu}
                        className="flex items-center gap-1 rounded-full border border-amber-500/60 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100 hover:bg-amber-500/20 transition-colors"
                    >
                        <DoorOpen className="h-3.5 w-3.5" />
                        Menu
                    </button>
                )}
                <button
                    onClick={logout}
                    className="flex items-center gap-1 rounded-full border border-red-500/60 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-100 hover:bg-red-500/20 transition-colors"
                >
                    <LogOut className="h-3.5 w-3.5" />
                    Sair
                </button>
            </div>
            <div className="relative z-10 flex flex-wrap gap-4 w-full">
            {hudItems.map((item) => (
                <div key={item.label} className="relative flex-1 min-w-[120px] sm:min-w-[160px] z-10">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
                        {item.icon}
                        {item.label}
                    </div>
                    <div className="mt-1 text-base sm:text-lg font-bold text-stone-100 break-words">{item.value}</div>
                    <div className="mt-2 h-2.5 rounded-full bg-stone-800 overflow-hidden border border-stone-700">
                        <div
                            className={cn('h-full rounded-full transition-all duration-700 ease-out', item.barClass)}
                            style={{ width: `${item.percent}%` }}
                        />
                    </div>
                </div>
            ))}
            </div>
        </div>
    );
};

export default GameHud;
