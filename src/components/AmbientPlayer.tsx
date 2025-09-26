'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { ambientSounds } from '@/data/ambient-sounds';
import { useSettingsContext } from '@/contexts/SettingsContext';

const FADE_DURATION = 2000; // 2 segundos em milissegundos

const AmbientPlayer: React.FC = () => {
    const { ambientSound } = useGameStateContext();
    const { volume, isMuted, playMenuMusic } = useSettingsContext();
    
    // Usaremos apenas um player de áudio para simplificar
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [currentSound, setCurrentSound] = useState<string | null>(null);

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
        const newUrl = soundData?.url ? window.location.origin + soundData.url : null;
        
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
            }, FADE_DURATION / (volume / 0.05));
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
                }, FADE_DURATION / (volume / 0.05));
            }).catch(e => console.warn("Ambient audio play failed:", e));

            setCurrentSound(targetSoundId);
        };
        
        // Se a nova URL for a mesma que está tocando, não faz nada.
        if (audio.src === newUrl && !audio.paused) {
            return;
        }

        fadeOut(() => {
            if (newUrl) {
                fadeIn();
            } else {
                setCurrentSound(null);
            }
        });

        // Cleanup ao desmontar
        return () => {
            if (fadeIntervalRef.current) {
                clearInterval(fadeIntervalRef.current);
            }
        };

    }, [ambientSound, playMenuMusic, volume]);

    return <audio ref={audioRef} loop />;
};

export default AmbientPlayer;
