'use client';

import { useEffect, useRef } from 'react';
import { AMBIENT_CROSSFADE_MS, fadeAudioVolume } from '@/lib/ambientSoundCrossfade';
import type { GameStage } from '@/types/gameStage';

const MENU_TRACK_URL = '/audios/index/inicio.mp3';

interface UseMenuMusicCrossfadeOptions {
  gameStage: GameStage;
  playMenuMusic: boolean;
  volume: number;
  isMuted: boolean;
}

export function useMenuMusicCrossfade({
  gameStage,
  playMenuMusic,
  volume,
  isMuted,
}: UseMenuMusicCrossfadeOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cancelFadeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio(MENU_TRACK_URL);
      audio.loop = true;
      audioRef.current = audio;
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const shouldPlay = playMenuMusic && gameStage !== 'playing';
    const targetVolume = isMuted ? 0 : volume;

    cancelFadeRef.current?.();
    cancelFadeRef.current = null;

    if (shouldPlay) {
      const startPlayback = () => {
        cancelFadeRef.current = fadeAudioVolume(audio, targetVolume, AMBIENT_CROSSFADE_MS);
      };
      if (audio.paused) {
        audio.volume = 0;
        audio
          .play()
          .then(startPlayback)
          .catch((e) => console.warn('Menu audio auto-play was prevented.', e));
      } else {
        startPlayback();
      }
    } else if (!audio.paused) {
      cancelFadeRef.current = fadeAudioVolume(audio, 0, AMBIENT_CROSSFADE_MS, () => {
        audio.pause();
        audio.volume = volume;
      });
    }

    return () => {
      cancelFadeRef.current?.();
    };
  }, [gameStage, playMenuMusic, volume, isMuted]);
}
