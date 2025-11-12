// src/services/ttsService.ts
import { apiClient } from './apiClient';

type GenerateNarrationResponse = {
  audioUrl: string;
  audioKey: string;
};

type PresignResponse = {
  audioUrl: string;
};

export const generateNarrationAudio = async (text: string) => {
  return apiClient<GenerateNarrationResponse>('/tts/generate', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
};

export const getSignedNarrationAudio = async (audioKey: string) => {
  return apiClient<PresignResponse>(`/tts/presign?key=${encodeURIComponent(audioKey)}`);
};
