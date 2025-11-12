// src/services/imageService.ts
import { apiClient } from './apiClient';

type GenerateImageResponse = {
    imageUrl: string;
    imageKey: string;
    size?: number;
    contentType?: string;
};

type PresignImageResponse = {
    imageUrl: string;
};

export const generateSceneImage = async (prompt: string, apiKey: string) => {
    return apiClient<GenerateImageResponse>('/images/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt, apiKey }),
    });
};

export const getSignedImageUrl = async (imageKey: string) => {
    return apiClient<PresignImageResponse>(`/images/presign?key=${encodeURIComponent(imageKey)}`);
};
