// src/services/ttsService.ts
import { apiClient } from './apiClient';

type GenerateNarrationResponse = {
  audioUrl: string;
};

export const generateNarrationAudio = async (text: string) => {
  return apiClient<GenerateNarrationResponse>('/tts/generate', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
};
