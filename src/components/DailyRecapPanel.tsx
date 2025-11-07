// src/components/DailyRecapPanel.tsx
'use client';

import React, { useMemo } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { Compass, Clock, CloudSun, Flame, Sparkles, MapPin, Trophy, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

const iconClasses = 'h-4 w-4 text-amber-300';

const parseLogSummary = (entry: any): string => {
    if (!entry) return '';
    if (typeof entry.content === 'string') {
        return entry.content;
    }
    if (entry.content?.title) return entry.content.title;
    if (entry.content?.text) return entry.content.text;
    if (entry.response) return entry.response;
    if (entry.prompt) return entry.prompt;
    return '';
};

const DailyRecapPanel: React.FC = () => {
    const { character, log, combatState } = useGameStateContext();
    if (!character) return null;

    const worldState = character.worldState || {};
    const location = worldState.location || character.currentRegion || 'Local desconhecido';
    const timeOfDay = worldState.timeOfDay || 'Horário indefinido';
    const climate = worldState.weather || worldState.climate || 'Clima imprevisível';
    const xpProgress = character.xpToNextLevel
        ? Math.max(0, Math.min(100, (character.xp / character.xpToNextLevel) * 100))
        : 0;
    const xpDiff = character.xpToNextLevel ? Math.max(character.xpToNextLevel - character.xp, 0) : null;

    const recentMoments = useMemo(() => {
        return log
            .slice(-4)
            .reverse()
            .map(entry => {
                const summary = parseLogSummary(entry);
                if (!summary) return null;
                return {
                    id: entry.id,
                    type: entry.type,
                    summary: summary.slice(0, 120),
                    timestamp: entry.timestamp,
                };
            })
            .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    }, [log]);

    const combatPulse = useMemo(() => {
        if (!combatState?.isActive || !combatState.combatants?.length) return null;
        const activeEnemies = combatState.combatants.filter(c => !c.isPlayer && c.attitude !== 'ally' && !c.isDead);
        const allies = combatState.combatants.filter(c => c.isPlayer || c.attitude === 'ally');
        return {
            round: combatState.round,
            turn: combatState.turn,
            foes: activeEnemies.length,
            allies: allies.length,
        };
    }, [combatState]);

    return (
        <div className="rounded-2xl border border-stone-700/70 bg-stone-950/60 backdrop-blur-md p-4 shadow-xl shadow-black/20 space-y-4">
            <header className="flex items-center justify-between">
                <div>
                    <p className="text-xs uppercase tracking-wide text-stone-500 font-semibold">Panorama</p>
                    <h3 className="text-lg font-bold text-amber-200">Resumo do Dia</h3>
                </div>
                <Sparkles className="h-5 w-5 text-amber-300" />
            </header>

            <section className="grid grid-cols-1 gap-3">
                <div className="rounded-xl border border-stone-700 bg-stone-900/50 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-stone-500">
                        <span>World Snapshot</span>
                        <Compass className={iconClasses} />
                    </div>
                    <div className="space-y-1 text-sm text-stone-200">
                        <p className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-emerald-300" /> {location}
                        </p>
                        <p className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-sky-300" /> {timeOfDay}
                        </p>
                        <p className="flex items-center gap-2">
                            <CloudSun className="h-4 w-4 text-amber-200" /> {climate}
                        </p>
                    </div>
                </div>

                <div className="rounded-xl border border-stone-700 bg-stone-900/50 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-stone-500">
                        <span>Progresso</span>
                        <Trophy className="h-4 w-4 text-amber-300" />
                    </div>
                    <div className="flex items-center justify-between text-stone-200 text-sm">
                        <span>Nível {character.level}</span>
                        {xpDiff !== null && <span>{xpDiff} XP para subir</span>}
                    </div>
                    <div className="h-2 w-full rounded-full bg-stone-800 overflow-hidden border border-stone-700">
                        <div
                            className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-lime-300 transition-all duration-700"
                            style={{ width: `${xpProgress}%` }}
                        />
                    </div>
                </div>
            </section>

            {combatPulse && (
                <section className="rounded-xl border border-red-800/50 bg-red-950/30 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-red-200">
                        <span>Combate em andamento</span>
                        <Flame className="h-4 w-4 text-red-200" />
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="rounded-lg border border-red-900/40 bg-red-950/40 p-2">
                            <p className="text-[10px] uppercase text-red-200/70">Round</p>
                            <p className="text-xl font-bold text-red-100">{combatPulse.round}</p>
                        </div>
                        <div className="rounded-lg border border-red-900/40 bg-red-950/40 p-2">
                            <p className="text-[10px] uppercase text-red-200/70">Turno</p>
                            <p className="text-xl font-bold text-red-100">{combatPulse.turn}</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-stone-200">
                        <span>{combatPulse.allies} aliados</span>
                        <span>{combatPulse.foes} inimigos</span>
                    </div>
                </section>
            )}

            {recentMoments.length > 0 && (
                <section>
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-stone-500 mb-2">
                        <span>Últimos acontecimentos</span>
                        <Activity className="h-4 w-4 text-emerald-300" />
                    </div>
                    <ul className="space-y-1.5 text-sm text-stone-200">
                        {recentMoments.map((moment, index) => (
                            <li
                                key={moment.id ?? `moment-${index}`}
                                className={cn(
                                    'rounded-lg border border-stone-800/70 bg-stone-900/40 p-2',
                                    moment.type === 'combat' && 'border-red-700/70 bg-red-950/20'
                                )}
                            >
                                <p className="text-xs uppercase tracking-wide text-amber-300">{moment.type}</p>
                                <p className="text-stone-100 text-sm leading-snug max-h-12 overflow-hidden">
                                    {moment.summary}
                                </p>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
};

export default DailyRecapPanel;
