'use client';

import React, { useRef, useEffect } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { ambientSounds } from '@/data/ambient-sounds';
import { useSettingsContext } from '@/contexts/SettingsContext';

const AmbientPlayer: React.FC = () => {
    const { ambientSound } = useGameStateContext();
    const { volume, isMuted, playMenuMusic } = useSettingsContext();
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        const soundData = ambientSounds.find(s => s.id === ambientSound);
        const newSoundUrl = soundData?.url || '';
        const audio = audioRef.current;

        if (!audio || !playMenuMusic) {
            if (audio) {
                audio.pause();
                audio.src = '';
            }
            return;
        };
        
        // Construct the full URL to avoid relative path issues
        const fullUrl = newSoundUrl ? window.location.origin + newSoundUrl : '';

        // If the URL has changed, update and play.
        if (audio.src !== fullUrl) {
            audio.src = fullUrl;
            if (newSoundUrl) {
                audio.load();
                audio.play().catch(e => console.error("Ambient audio play failed:", e));
            } else {
                audio.pause();
            }
        }
    }, [ambientSound, playMenuMusic]);
    
    // Efeito para controlar o estado de mudo e o volume.
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.muted = isMuted;
            audioRef.current.volume = isMuted ? 0 : volume;
        }
    }, [isMuted, volume]);

    // O atributo 'loop' no elemento de áudio cuidará da repetição.
    return <audio ref={audioRef} loop />;
};

export default AmbientPlayer;
