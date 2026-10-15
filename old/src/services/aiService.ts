// src/services/aiService.ts
import { apiClient } from './apiClient';

export interface GenerateHomebrewPayload {
    prompt: string;
    type: 'race' | 'subrace' | 'class' | 'subclass' | 'spell' | 'item' | 'monster' | 'background' | 'feat';
    apiKey: string;
}

export const createHomebrewContent = async (payload: GenerateHomebrewPayload) => {
    return apiClient<{ content: any }>('/ai/create-homebrew', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
};
