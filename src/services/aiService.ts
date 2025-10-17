// src/services/aiService.ts
import { apiClient } from './apiClient';

export interface GenerateHomebrewPayload {
    prompt: string;
    type: 'race' | 'subrace' | 'class' | 'subclass' | 'spell' | 'item' | 'monster' | 'background' | 'feat';
    apiKey: string;
}

export interface GenerateImagePayload {
    prompt: string;
    model: string;
    apiKey: string;
}

export const createHomebrewContent = async (payload: GenerateHomebrewPayload) => {
    return apiClient<{ content: any }>('/ai/create-homebrew', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
};

export const generateImage = async (payload: GenerateImagePayload): Promise<{ imageUrl: string } | null> => {
    try {
        const result = await apiClient<{ imageUrl: string }>('/ai/generate-image', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        return result;
    } catch (error) {
        console.error('Error in generateImage service:', error);
        return null;
    }
}
