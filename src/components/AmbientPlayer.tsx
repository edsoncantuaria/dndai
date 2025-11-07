'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { ambientSounds, AmbientSound } from '@/data/ambient-sounds';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { Music3, ChevronDown } from 'lucide-react';

const FADE_DURATION = 2000; // 2 segundos em milissegundos

const AmbientPlayer: React.FC = () => {
    const { ambientSound, character } = useGameStateContext();
    const { volume, isMuted, playMenuMusic } = useSettingsContext();
    
    // Usaremos apenas um player de áudio para simplificar
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [currentAmbient, setCurrentAmbient] = useState<AmbientSound | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    // Efeito para criar e configurar o elemento de áudio
    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio();
            audioRef.current.loop = true;
        }
    }, []);

    // Efeito para controlar o volume e o estado mudo
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        
        audio.muted = isMuted;
        if (!isMuted) {
            audio.volume = volume;
        }
    }, [isMuted, volume]);

    // Efeito principal para trocar de faixa
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const targetSoundId = playMenuMusic ? ambientSound : 'none';
        const soundData = ambientSounds.find(s => s.id === targetSoundId);
        const newUrl = soundData?.url && typeof window !== 'undefined' ? window.location.origin + soundData.url : null;
        const safeVolume = Math.max(volume, 0.05);
        
        const fadeOut = (callback: () => void) => {
            if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
            if (audio.volume === 0 || isNaN(audio.duration) || audio.paused) {
                callback();
                return;
            }
            
            let currentVolume = audio.volume;
            fadeIntervalRef.current = setInterval(() => {
                currentVolume -= 0.05; // Ajuste para uma transição de 2 segundos
                if (currentVolume <= 0) {
                    clearInterval(fadeIntervalRef.current!);
                    audio.pause();
                    audio.volume = volume; // Reseta o volume para a próxima vez
                    callback();
                } else {
                    audio.volume = currentVolume;
                }
            }, FADE_DURATION / Math.max(safeVolume / 0.05, 1));
        };

        const fadeIn = () => {
            if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
            if (!newUrl) return;

            audio.src = newUrl;
            audio.volume = 0;

            audio.play().then(() => {
                let currentVolume = 0;
                fadeIntervalRef.current = setInterval(() => {
                    currentVolume += 0.05;
                     if (currentVolume >= volume) {
                        clearInterval(fadeIntervalRef.current!);
                        audio.volume = volume;
                    } else {
                        audio.volume = currentVolume;
                    }
                }, FADE_DURATION / Math.max(safeVolume / 0.05, 1));
            }).catch(e => console.warn("Ambient audio play failed:", e));

            setCurrentAmbient(soundData ?? null);
        };
        
        // Se a nova URL for a mesma que está tocando, não faz nada.
        if (audio.src === newUrl && !audio.paused) {
            return;
        }

        fadeOut(() => {
            if (newUrl) {
                fadeIn();
            } else {
                setCurrentAmbient(null);
            }
        });

        // Cleanup ao desmontar
        return () => {
            if (fadeIntervalRef.current) {
                clearInterval(fadeIntervalRef.current);
            }
        };

    }, [ambientSound, playMenuMusic, volume]);

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
            <audio ref={audioRef} loop className="hidden" />
        </div>
    );
};

export default AmbientPlayer;
