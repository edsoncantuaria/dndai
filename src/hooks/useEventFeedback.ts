// src/hooks/useEventFeedback.ts
'use client';

import { useCallback, useRef } from 'react';
import { useSettingsContext } from '@/contexts/SettingsContext';

type EventCue =
    | 'xp'
    | 'loot'
    | 'relationshipUp'
    | 'relationshipDown'
    | 'shop'
    | 'hpLoss'
    | 'hpGain'
    | 'resourceUse'
    | 'diceRoll'
    | 'diceCritical'
    | 'diceFailure';

const cueConfig: Record<EventCue, { frequency: number; duration: number; vibrate: number | number[] }> = {
    xp: { frequency: 920, duration: 180, vibrate: 25 },
    loot: { frequency: 640, duration: 200, vibrate: 30 },
    relationshipUp: { frequency: 760, duration: 160, vibrate: 20 },
    relationshipDown: { frequency: 420, duration: 220, vibrate: 35 },
    shop: { frequency: 520, duration: 160, vibrate: 18 },
    hpLoss: { frequency: 380, duration: 240, vibrate: 40 },
    hpGain: { frequency: 680, duration: 220, vibrate: 25 },
    resourceUse: { frequency: 560, duration: 200, vibrate: 22 },
    diceRoll: { frequency: 320, duration: 140, vibrate: 18 },
    diceCritical: { frequency: 920, duration: 320, vibrate: [20, 40, 55, 30] },
    diceFailure: { frequency: 180, duration: 280, vibrate: [45, 35, 50] },
};

export const useEventFeedback = () => {
    const { eventCuesEnabled, hapticsEnabled } = useSettingsContext();
    const audioCtxRef = useRef<AudioContext | null>(null);

    const ensureContext = useCallback(() => {
        if (typeof window === 'undefined') return null;
        if (!audioCtxRef.current) {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            audioCtxRef.current = AudioCtx ? new AudioCtx() : null;
        }
        return audioCtxRef.current;
    }, []);

    const triggerVibration = useCallback(
        (pattern: number | number[]) => {
            if (!hapticsEnabled) return;
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate(pattern);
            }
        },
        [hapticsEnabled]
    );

    const triggerTone = useCallback(
        (frequency: number, duration: number) => {
            if (!eventCuesEnabled) return;
            const ctx = ensureContext();
            if (!ctx) return;

            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.value = frequency;

            const currentTime = ctx.currentTime;
            gain.gain.setValueAtTime(0.001, currentTime);
            gain.gain.exponentialRampToValueAtTime(0.2, currentTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, currentTime + duration / 1000);

            oscillator.connect(gain);
            gain.connect(ctx.destination);
            oscillator.start(currentTime);
            oscillator.stop(currentTime + duration / 1000 + 0.02);
        },
        [ensureContext, eventCuesEnabled]
    );

    const playCue = useCallback(
        (cue: EventCue) => {
            const config = cueConfig[cue];
            if (!config) return;
            triggerTone(config.frequency, config.duration);
            triggerVibration(config.vibrate);
        },
        [triggerTone, triggerVibration]
    );

    return { playCue };
};

export type { EventCue };
