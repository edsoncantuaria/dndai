'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { ambientSounds } from '@/data/ambient-sounds';
import { useSettingsContext } from '@/contexts/SettingsContext';

const FADE_DURATION = 2000; // 2 segundos em milissegundos

const AmbientPlayer: React.FC = () => {
    const { ambientSound } = useGameStateContext();
    const { volume, isMuted, playMenuMusic } = useSettingsContext();
    
    // Usaremos dois players para permitir o crossfade
    const audioRef1 = useRef<HTMLAudioElement>(null);
    const audioRef2 = useRef<HTMLAudioElement>(null);
    const [activePlayerRef, setActivePlayerRef] = useState(audioRef1);
    const fadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const audio1 = audioRef1.current;
        const audio2 = audioRef2.current;
        if (!audio1 || !audio2) return;

        // Função para parar e limpar todos os sons
        const stopAllAudio = () => {
            if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
            [audio1, audio2].forEach(audio => {
                audio.pause();
                if (!isNaN(audio.duration)) {
                   audio.currentTime = 0;
                }
            });
        };

        if (!playMenuMusic || ambientSound === 'none') {
            stopAllAudio();
            return;
        }

        const soundData = ambientSounds.find(s => s.id === ambientSound);
        const newSoundUrl = soundData?.url ? window.location.origin + soundData.url : '';

        if (!newSoundUrl) {
            stopAllAudio();
            return;
        }
        
        const currentPlayer = activePlayerRef.current;
        const nextPlayer = activePlayerRef === audioRef1 ? audio2 : audio1;

        // Se o player atual já estiver tocando o som correto, não faz nada
        if (currentPlayer && currentPlayer.src === newSoundUrl && !currentPlayer.paused) {
            return;
        }

        // Limpa qualquer transição anterior
        if (fadeTimeoutRef.current) {
            clearTimeout(fadeTimeoutRef.current);
        }
        
        // Prepara o próximo player
        nextPlayer.src = newSoundUrl;
        nextPlayer.loop = true;
        nextPlayer.volume = 0; // Começa silencioso
        
        const playPromise = nextPlayer.play();

        if (playPromise !== undefined) {
             playPromise.then(() => {
                const now = performance.now();
                const fade = () => {
                    const elapsedTime = performance.now() - now;
                    const progress = Math.min(elapsedTime / FADE_DURATION, 1);

                    // Fade in o próximo player
                    nextPlayer.volume = isMuted ? 0 : progress * volume;
                    
                    // Fade out o player atual
                    if (currentPlayer && !currentPlayer.paused) {
                        currentPlayer.volume = isMuted ? 0 : (1 - progress) * volume;
                    }

                    if (progress < 1) {
                       requestAnimationFrame(fade);
                    } else {
                        if (currentPlayer) {
                           currentPlayer.pause();
                           if(!isNaN(currentPlayer.duration)) {
                               currentPlayer.currentTime = 0;
                           }
                        }
                        setActivePlayerRef(activePlayerRef === audioRef1 ? audioRef2 : audioRef1);
                    }
                };
                requestAnimationFrame(fade);

            }).catch(error => {
                console.error("Ambient audio play failed:", error);
                // Mesmo com falha, garante que o volume esteja correto se for um problema de interação
                nextPlayer.volume = isMuted ? 0 : volume;
            });
        }


    }, [ambientSound, playMenuMusic, volume, isMuted, activePlayerRef]);
    
    // Efeito para controlar o estado de mudo e o volume do player ativo.
    useEffect(() => {
        if (audioRef1.current) audioRef1.current.muted = isMuted;
        if (audioRef2.current) audioRef2.current.muted = isMuted;

        if (activePlayerRef.current) {
            activePlayerRef.current.volume = isMuted ? 0 : volume;
        }
    }, [isMuted, volume, activePlayerRef]);

    return (
        <>
            <audio ref={audioRef1} loop />
            <audio ref={audioRef2} loop />
        </>
    );
};

export default AmbientPlayer;
