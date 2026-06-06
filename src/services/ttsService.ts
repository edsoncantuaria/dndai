// src/services/ttsService.ts
import { apiClient } from './apiClient';
import {
  NARRATION_LENGTH_SCALE,
  NARRATION_VOICE,
  type NarrationSpeedPreset,
  type PiperVoiceId,
} from '@/lib/narrationTts';
import { getRuntimeApiUrl } from '@/lib/runtimeApiConfig';

const API_URL = getRuntimeApiUrl();

type GenerateNarrationResponse = {
  audioUrl: string;
  audioKey: string;
};

/** URL de reprodução via backend (MinIO só interno). Inclui access_token para `<audio src>`. */
export const buildNarrationAudioUrl = (audioKey: string): string => {
  const base = `${API_URL}/v2/tts/audio?key=${encodeURIComponent(audioKey)}`;
  if (typeof window === 'undefined') {
    return base;
  }
  const token = localStorage.getItem('token');
  return token ? `${base}&access_token=${encodeURIComponent(token)}` : base;
};

/** Atualiza token em URL de playback já gerada pelo backend. */
export const withPlaybackAuthToken = (audioUrl: string): string => {
  if (typeof window === 'undefined' || !audioUrl.includes('/tts/audio')) {
    return audioUrl;
  }
  const token = localStorage.getItem('token');
  if (!token) return audioUrl;
  try {
    const parsed = new URL(audioUrl, API_URL);
    parsed.searchParams.set('access_token', token);
    return parsed.toString();
  } catch {
    const sep = audioUrl.includes('?') ? '&' : '?';
    return `${audioUrl}${sep}access_token=${encodeURIComponent(token)}`;
  }
};

export const resolveNarrationPlaybackUrl = (audioKey?: string | null, audioUrl?: string | null): string | null => {
  if (audioKey) {
    return buildNarrationAudioUrl(audioKey);
  }
  if (audioUrl) {
    return withPlaybackAuthToken(audioUrl);
  }
  return null;
};

export type GenerateNarrationOptions = {
  narrationVoice?: PiperVoiceId;
  narrationSpeed?: NarrationSpeedPreset;
};

export const generateNarrationAudio = async (text: string, options?: GenerateNarrationOptions) => {
  const result = await apiClient<GenerateNarrationResponse>('/v2/tts/generate', {
    method: 'POST',
    body: JSON.stringify({
      text,
      voice: NARRATION_VOICE,
      narrationVoice: options?.narrationVoice ?? NARRATION_VOICE,
      narrationSpeed: options?.narrationSpeed ?? 'normal',
      lengthScale: NARRATION_LENGTH_SCALE,
    }),
  });
  return {
    ...result,
    audioUrl: result.audioKey
      ? buildNarrationAudioUrl(result.audioKey)
      : withPlaybackAuthToken(result.audioUrl),
  };
};

/** @deprecated Use buildNarrationAudioUrl(audioKey). Mantido para logs antigos sem audioKey. */
export const getSignedNarrationAudio = async (audioKey: string) => {
  return { audioUrl: buildNarrationAudioUrl(audioKey) };
};
