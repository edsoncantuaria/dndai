// src/services/translationService.ts
import { apiClient } from './apiClient';

export const getTranslations = async (): Promise<Record<string, Record<string, string>>> => {
    return apiClient<Record<string, Record<string, string>>>('/translations');
};
