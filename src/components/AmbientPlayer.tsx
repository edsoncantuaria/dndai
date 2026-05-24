'use client';

import React, { useState } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { useAmbientTrackPlayer } from '@/hooks/useAmbientTrackPlayer';
import { Music3, ChevronDown } from 'lucide-react';

interface AmbientPlayerProps {
    variant?: 'panel' | 'chip' | 'icon';
}

const AmbientPlayer: React.FC<AmbientPlayerProps> = ({ variant = 'panel' }) => {
    const { character } = useGameStateContext();
    const { volume } = useSettingsContext();
    const { audioRef, currentAmbient } = useAmbientTrackPlayer();
    const [isExpanded, setIsExpanded] = useState(false);

    const timeOfDay = character?.worldState?.timeOfDay?.toLowerCase() || '';
    const gradientByTag: Record<string, string> = {
        battle: 'from-red-600/15 via-red-500/10 to-transparent',
        dungeon: 'from-purple-700/15 via-indigo-700/10 to-transparent',
        forest: 'from-emerald-500/15 via-lime-400/10 to-transparent',
        tavern: 'from-amber-500/15 via-orange-500/10 to-transparent',
        storm: 'from-sky-600/15 via-indigo-700/10 to-transparent',
    };

    const deriveGradient = () => {
        if (currentAmbient) {
            const matchedTag = currentAmbient.tags.find(tag => gradientByTag[tag]);
            if (matchedTag) {
                return gradientByTag[matchedTag];
            }
        }
        if (timeOfDay.includes('noite')) return 'from-indigo-900/15 via-blue-900/10 to-transparent';
        if (timeOfDay.includes('manhã')) return 'from-amber-300/15 via-yellow-200/10 to-transparent';
        if (timeOfDay.includes('tarde')) return 'from-orange-400/15 via-amber-300/10 to-transparent';
        return 'from-stone-900/15 via-stone-800/10 to-transparent';
    };

    const audioElement = <audio ref={audioRef} loop className="hidden" />;

    if (variant === 'icon') {
        return (
            <>
                <button
                    onClick={() => setIsExpanded(true)}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/30 text-stone-200 transition hover:border-amber-200/40"
                >
                    <span className="sr-only">Trilha ambiente</span>
                    <Music3 className="h-5 w-5" />
                </button>
                {isExpanded && (
                    <div className="fixed inset-0 z-40 flex items-end sm:items-center sm:justify-center">
                        <div className="absolute inset-0 bg-black/70" onClick={() => setIsExpanded(false)} />
                        <div className="relative z-10 m-4 w-full max-w-sm rounded-3xl border border-white/15 bg-[#090f19] p-4 text-sm text-stone-200 shadow-2xl">
                            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-stone-500">
                                <span>{currentAmbient ? 'Tocando agora' : 'Silêncio'}</span>
                                <button onClick={() => setIsExpanded(false)} className="text-stone-500 hover:text-stone-200">Fechar</button>
                            </div>
                            <div className="mt-3 space-y-2">
                                <p className="text-base font-semibold text-white">{currentAmbient?.name ?? 'Nenhuma trilha ativa'}</p>
                                <p className="text-xs text-stone-500">
                                    {currentAmbient ? currentAmbient.tags.slice(0, 3).join(' · ') : 'Selecione uma faixa no menu principal.'}
                                </p>
                                <p className="text-[11px] text-stone-500">Volume {Math.round(volume * 100)}%</p>
                                {character?.worldState?.timeOfDay && (
                                    <p className="text-[11px] text-stone-500">{character.worldState.timeOfDay}</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                {audioElement}
            </>
        );
    }

    if (variant === 'chip') {
        return (
            <>
                <button
                    onClick={() => setIsExpanded((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-2 text-[11px] font-semibold text-stone-200 transition hover:border-amber-200/40"
                >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400/20 text-amber-200">
                        <Music3 className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-left">
                        {currentAmbient?.name ?? 'Nenhuma trilha ativa'}
                    </span>
                    <ChevronDown className={`ml-auto h-3.5 w-3.5 text-stone-400 transition ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
                {isExpanded && (
                    <div className="mt-2 rounded-2xl border border-white/10 bg-black/40 p-3 text-xs text-stone-300">
                        <div className="flex items-center justify-between">
                            <span>{currentAmbient ? 'Tocando agora' : 'Em silêncio'}</span>
                            <span className="text-stone-500">Vol {Math.round(volume * 100)}%</span>
                        </div>
                        <p className="mt-1 text-stone-400 text-xs">
                            {currentAmbient?.tags.slice(0, 2).join(' · ') || 'Selecione uma faixa no menu principal.'}
                        </p>
                    </div>
                )}
                {audioElement}
            </>
        );
    }

    return (
        <div className="space-y-3">
            <button
                onClick={() => setIsExpanded((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-3xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-stone-100 shadow-lg shadow-black/30 backdrop-blur-lg"
            >
                <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-amber-400/20 text-amber-200">
                    <Music3 className="h-4 w-4" />
                </span>
                <div className="text-left">
                    <p className="text-xs uppercase tracking-[0.35em] text-stone-400">Trilha ambiente</p>
                    <p>{currentAmbient?.name ?? 'Nenhuma trilha ativa'}</p>
                </div>
                <ChevronDown
                    className={`ml-auto h-4 w-4 text-stone-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                />
            </button>
            {isExpanded && (
                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm">
                    <div className={`absolute inset-0 bg-gradient-to-r ${deriveGradient()} opacity-30`} />
                    <div className="relative p-4 sm:p-5 flex flex-col gap-3 text-sm text-stone-200">
                        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.35em] text-stone-400">
                            <span>{currentAmbient ? 'Tocando agora' : 'Em silêncio'}</span>
                            <span className="text-[10px] tracking-widest text-stone-500">Volume {Math.round(volume * 100)}%</span>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-lg font-semibold text-white">{currentAmbient?.name ?? 'Selecione uma trilha no menu'}</p>
                                {currentAmbient ? (
                                    <p className="text-xs uppercase tracking-wide text-stone-400">
                                        {currentAmbient.tags.slice(0, 2).join(' · ')}
                                    </p>
                                ) : (
                                    <p className="text-xs text-stone-500">Ative sons ambientes para intensificar a imersão.</p>
                                )}
                            </div>
                            <div className="text-xs text-stone-400 text-right">
                                {character?.worldState?.location && <p>{character.worldState.location}</p>}
                                {character?.worldState?.timeOfDay && <p>{character.worldState.timeOfDay}</p>}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {audioElement}
        </div>
    );
};

export default AmbientPlayer;
