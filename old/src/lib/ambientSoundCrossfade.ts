import type { MutableRefObject } from 'react';

/** Duração padrão de crossfade entre faixas ambiente / menu (ms). */
export const AMBIENT_CROSSFADE_MS = 2000;

const FADE_STEP = 0.05;

export function clearFadeInterval(
  ref: MutableRefObject<ReturnType<typeof setInterval> | null>
): void {
  if (ref.current) {
    clearInterval(ref.current);
    ref.current = null;
  }
}

/**
 * Fade linear de volume em um elemento de áudio.
 * Retorna função de cancelamento.
 */
export function fadeAudioVolume(
  audio: HTMLAudioElement,
  targetVolume: number,
  durationMs: number = AMBIENT_CROSSFADE_MS,
  onComplete?: () => void
): () => void {
  const safeTarget = Math.max(0, Math.min(1, targetVolume));
  const startVolume = audio.volume;
  if (Math.abs(startVolume - safeTarget) < 0.01) {
    audio.volume = safeTarget;
    onComplete?.();
    return () => undefined;
  }

  const steps = Math.max(Math.ceil(safeTarget / FADE_STEP), Math.ceil((1 - startVolume) / FADE_STEP), 1);
  const intervalMs = durationMs / steps;
  let currentVolume = startVolume;
  const delta = (safeTarget - startVolume) / steps;

  const id = setInterval(() => {
    currentVolume += delta;
    if (
      (delta > 0 && currentVolume >= safeTarget) ||
      (delta <= 0 && currentVolume <= safeTarget)
    ) {
      clearInterval(id);
      audio.volume = safeTarget;
      onComplete?.();
    } else {
      audio.volume = currentVolume;
    }
  }, intervalMs);

  return () => clearInterval(id);
}

export function crossfadeAudioTrack(
  audio: HTMLAudioElement,
  nextUrl: string | null,
  targetVolume: number,
  fadeIntervalRef: MutableRefObject<ReturnType<typeof setInterval> | null>,
  onTrackChange?: () => void
): void {
  clearFadeInterval(fadeIntervalRef);

  const fadeOutThen = (after: () => void) => {
    if (audio.volume === 0 || audio.paused || Number.isNaN(audio.duration)) {
      after();
      return;
    }
    fadeAudioVolume(audio, 0, AMBIENT_CROSSFADE_MS, () => {
      audio.pause();
      after();
    });
  };

  fadeOutThen(() => {
    if (!nextUrl) {
      onTrackChange?.();
      return;
    }

    audio.src = nextUrl;
    audio.volume = 0;
    audio
      .play()
      .then(() => {
        fadeAudioVolume(audio, targetVolume, AMBIENT_CROSSFADE_MS, onTrackChange);
      })
      .catch((e) => console.warn('Ambient audio play failed:', e));
  });
}
