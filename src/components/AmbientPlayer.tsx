'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { ambientSounds } from '@/data/ambient-sounds';
import { Volume2, VolumeX } from 'lucide-react';

const AmbientPlayer: React.FC = () => {
    const { ambientSound } = useGameStateContext();
    const audioRef = useRef<HTMLAudioElement>(null);
    const [currentSound, setCurrentSound] = useState<string | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(0.3); // Volume inicial de 30%

    useEffect(() => {
        const soundData = ambientSounds.find(s => s.id === ambientSound);
        const newSoundUrl = soundData?.url;

        if (audioRef.current) {
            if (newSoundUrl && newSoundUrl !== currentSound) {
                // Fade out, change source, then fade in
                const fadeOutInterval = setInterval(() => {
                    if (audioRef.current && audioRef.current.volume > 0.01) {
                        audioRef.current.volume = Math.max(0, audioRef.current.volume - 0.05);
                    } else {
                        clearInterval(fadeOutInterval);
                        if (audioRef.current) {
                            audioRef.current.src = newSoundUrl;
                            audioRef.current.load();
                            audioRef.current.play().catch(e => console.error("Audio play failed:", e));
                            setCurrentSound(newSoundUrl);
                            
                            const fadeInInterval = setInterval(() => {
                                if (audioRef.current && audioRef.current.volume < volume) {
                                     audioRef.current.volume = Math.min(volume, audioRef.current.volume + 0.05);
                                } else {
                                    clearInterval(fadeInInterval);
                                }
                            }, 100);
                        }
                    }
                }, 100);

            } else if (!newSoundUrl && currentSound) {
                // Fade out and stop
                const fadeOutInterval = setInterval(() => {
                     if (audioRef.current && audioRef.current.volume > 0.01) {
                        audioRef.current.volume = Math.max(0, audioRef.current.volume - 0.05);
                    } else {
                        clearInterval(fadeOutInterval);
                        if (audioRef.current) {
                            audioRef.current.pause();
                            audioRef.current.src = "";
                            setCurrentSound(null);
                        }
                    }
                }, 100);
            }
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

    return (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2 p-2 bg-stone-900/50 rounded-full border border-stone-700">
            <button onClick={() => setIsMuted(m => !m)} className="text-stone-300 hover:text-white">
                {isMuted ? <VolumeX size={20}/> : <Volume2 size={20} />}
            </button>
            <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-24 h-1 bg-stone-700 rounded-lg appearance-none cursor-pointer"
                style={{ WebkitAppearance: 'none' }}
            />
            <audio ref={audioRef} loop />
        </div>
    );
};

export default AmbientPlayer;
