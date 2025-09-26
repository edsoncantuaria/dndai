'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { ambientSounds } from '@/data/ambient-sounds';
import { useSettingsContext } from '@/contexts/SettingsContext';

const AmbientPlayer: React.FC = () => {
    const { ambientSound } = useGameStateContext();
    const { volume, isMuted } = useSettingsContext();
    const audioRef = useRef<HTMLAudioElement>(null);
    const [currentSound, setCurrentSound] = useState<string | null>(null);

    useEffect(() => {
        const soundData = ambientSounds.find(s => s.id === ambientSound);
        const newSoundUrl = soundData?.url;
        const audio = audioRef.current;

        if (!audio) return;

        if (newSoundUrl && newSoundUrl !== currentSound) {
            // Fade out, change source, then fade in
            let fadeOutVolume = audio.volume;
            const fadeOutInterval = setInterval(() => {
                if (fadeOutVolume > 0.01) {
                    fadeOutVolume = Math.max(0, fadeOutVolume - 0.1);
                    audio.volume = fadeOutVolume;
                } else {
                    clearInterval(fadeOutInterval);
                    audio.pause();
                    audio.src = newSoundUrl;
                    setCurrentSound(newSoundUrl);
                    audio.load();
                    audio.play().catch(e => console.error("Audio play failed:", e));
                    
                    let fadeInVolume = 0;
                    const fadeInInterval = setInterval(() => {
                        if (fadeInVolume < volume) {
                            fadeInVolume = Math.min(volume, fadeInVolume + 0.1);
                            audio.volume = fadeInVolume;
                        } else {
                            clearInterval(fadeInInterval);
                        }
                    }, 100);
                }
            }, 100);

        } else if (!newSoundUrl && currentSound) {
            // Fade out and stop
            let fadeOutVolume = audio.volume;
            const fadeOutInterval = setInterval(() => {
                 if (fadeOutVolume > 0.01) {
                    fadeOutVolume = Math.max(0, fadeOutVolume - 0.1);
                    audio.volume = fadeOutVolume;
                } else {
                    clearInterval(fadeOutInterval);
                    audio.pause();
                    audio.src = "";
                    setCurrentSound(null);
                }
            }, 100);
        }

    }, [ambientSound, currentSound, volume]);
    
     useEffect(() => {
        if (audioRef.current) {
            audioRef.current.muted = isMuted;
        }
    }, [isMuted]);

    useEffect(() => {
        if (audioRef.current && !isMuted) {
            audioRef.current.volume = volume;
        }
    }, [volume, isMuted]);

    // O componente agora não renderiza nenhuma UI visível.
    return <audio ref={audioRef} loop />;
};

export default AmbientPlayer;
