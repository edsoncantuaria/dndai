'use client';

import React, { useRef, useEffect } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { ambientSounds } from '@/data/ambient-sounds';
import { useSettingsContext } from '@/contexts/SettingsContext';

const AmbientPlayer: React.FC = () => {
    const { ambientSound } = useGameStateContext();
    const { volume, isMuted } = useSettingsContext();
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        const soundData = ambientSounds.find(s => s.id === ambientSound);
        const newSoundUrl = soundData?.url || '';
        const audio = audioRef.current;

        if (!audio) return;

        // Se a URL mudou, atualize e toque.
        if (audio.src !== window.location.origin + newSoundUrl) {
            audio.src = newSoundUrl;
            if (newSoundUrl) {
                audio.load();
                audio.play().catch(e => console.error("Audio play failed:", e));
            } else {
                audio.pause();
            }
        }
    }, [ambientSound]);
    
    // Efeito para controlar o estado de mudo.
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.muted = isMuted;
        }
    }, [isMuted]);

    // Efeito para controlar o volume.
    useEffect(() => {
        if (audioRef.current && !isMuted) {
            audioRef.current.volume = volume;
        }
    }, [volume, isMuted]);

    // O atributo 'loop' no elemento de áudio cuidará da repetição.
    return <audio ref={audioRef} loop />;
};

export default AmbientPlayer;
