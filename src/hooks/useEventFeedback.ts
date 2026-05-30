'use client';

import { useCallback, useRef } from 'react';
import { useSettingsContext } from '@/contexts/SettingsContext';
import {
  GAME_SFX_URLS,
  GAME_SFX_VOLUME_SCALE,
  type GameSfxId,
} from '@/lib/gameSfx';

type EventCue = GameSfxId;

const cueVibrate: Record<EventCue, number | number[]> = {
  xp: 25,
  loot: 30,
  relationshipUp: 20,
  relationshipDown: 35,
  shop: 18,
  hpLoss: 40,
  hpGain: 25,
  resourceUse: 22,
  diceRoll: 18,
  diceCritical: [20, 40, 55, 30],
  diceFailure: [45, 35, 50],
};

export const useEventFeedback = () => {
  const { eventCuesEnabled, hapticsEnabled, volume, isMuted } = useSettingsContext();
  const sampleCacheRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const triggerVibration = useCallback(
    (pattern: number | number[]) => {
      if (!hapticsEnabled) return;
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    },
    [hapticsEnabled]
  );

  const playSample = useCallback(
    (url: string) => {
      if (!eventCuesEnabled || isMuted || typeof window === 'undefined') return;

      let audio = sampleCacheRef.current.get(url);
      if (!audio) {
        audio = new Audio(url);
        sampleCacheRef.current.set(url, audio);
      }

      audio.volume = Math.min(1, Math.max(0, volume * GAME_SFX_VOLUME_SCALE));
      audio.currentTime = 0;
      void audio.play().catch(() => {
        /* autopolicy ou arquivo ausente — ignorar */
      });
    },
    [eventCuesEnabled, isMuted, volume]
  );

  const playCue = useCallback(
    (cue: EventCue) => {
      const url = GAME_SFX_URLS[cue];
      if (!url) return;
      playSample(url);
      triggerVibration(cueVibrate[cue]);
    },
    [playSample, triggerVibration]
  );

  return { playCue };
};

export type { EventCue };
