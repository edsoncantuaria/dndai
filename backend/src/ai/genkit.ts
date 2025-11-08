// backend/src/ai/genkit.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

type GenerativeModel = ReturnType<GoogleGenerativeAI['getGenerativeModel']>;

const clientCache = new Map<string, GoogleGenerativeAI>();
const modelCache = new Map<string, GenerativeModel>();

const normalizeKey = (apiKey: string) => apiKey?.trim();

const getClient = (apiKey: string) => {
    const normalized = normalizeKey(apiKey);
    if (!normalized) {
        throw new Error('Gemini API key is required for this operation.');
    }
    if (!clientCache.has(normalized)) {
        clientCache.set(normalized, new GoogleGenerativeAI(normalized));
    }
    return clientCache.get(normalized)!;
};

export const getModel = (model: string, apiKey: string): GenerativeModel => {
    const normalizedKey = normalizeKey(apiKey);
    if (!normalizedKey) {
        throw new Error('Gemini API key is required for this operation.');
    }
    const cacheKey = `${normalizedKey}:${model}`;
    if (modelCache.has(cacheKey)) {
        return modelCache.get(cacheKey)!;
    }
    const instance = getClient(normalizedKey).getGenerativeModel({ model });
    modelCache.set(cacheKey, instance);
    return instance;
};
