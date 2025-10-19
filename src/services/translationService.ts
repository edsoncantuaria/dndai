// src/services/translationService.ts
import { apiClient } from './apiClient';

export const getTranslations = async (): Promise<Record<string, Record<string, any>>> => {
    return apiClient<Record<string, Record<string, any>>>('/translations');
};
