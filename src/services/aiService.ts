// src/services/aiService.ts
import { apiClient } from './apiClient';
import type { HomebrewContentType } from './homebrewService';

interface CreateHomebrewPayload {
    prompt: string;
    type: HomebrewContentType;
    apiKey: string;
}

export const createHomebrewContent = async (payload: CreateHomebrewPayload): Promise<{ content: any }> => {
    return apiClient<{ content: any }>('/ai/create-homebrew', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
};
