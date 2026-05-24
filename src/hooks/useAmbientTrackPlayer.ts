'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { ambientSounds, type AmbientSound } from '@/data/ambient-sounds';
import { useSettingsContext } from '@/contexts/SettingsContext';
import {
  AMBIENT_CROSSFADE_MS,
  clearFadeInterval,
  crossfadeAudioTrack,
} from '@/lib/ambientSoundCrossfade';

export function useAmbientTrackPlayer() {
  const { ambientSound } = useGameStateContext();
  const { volume, isMuted, playAmbientMusic } = useSettingsContext();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [currentAmbient, setCurrentAmbient] = useState<AmbientSound | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.loop = true;
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.muted = isMuted;
    if (!isMuted && !audio.paused) {
      audio.volume = volume;
    }
  }, [isMuted, volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const targetSoundId = playAmbientMusic ? ambientSound : 'none';
    const soundData = ambientSounds.find((s) => s.id === targetSoundId);
    const newUrl =
      soundData?.url && typeof window !== 'undefined'
        ? window.location.origin + soundData.url
        : null;

    if (audio.src === newUrl && !audio.paused && newUrl) {
      return;
    }

    const safeVolume = Math.max(volume, 0.05);

    crossfadeAudioTrack(audio, newUrl, isMuted ? 0 : safeVolume, fadeIntervalRef, () => {
      setCurrentAmbient(newUrl ? (soundData ?? null) : null);
    });

    return () => clearFadeInterval(fadeIntervalRef);
  }, [ambientSound, playAmbientMusic, volume, isMuted]);

  return { audioRef, currentAmbient, fadeDurationMs: AMBIENT_CROSSFADE_MS };
}
