// backend/src/ai/genkit.ts
import { GoogleGenAI } from '@google/genai';

type ModelsClient = GoogleGenAI['models'];
type GenerateContentParams = Parameters<ModelsClient['generateContent']>[0];
type GenerateContentStreamParams = Parameters<ModelsClient['generateContentStream']>[0];
type CountTokensParams = Parameters<ModelsClient['countTokens']>[0];
type EmbedContentParams = Parameters<ModelsClient['embedContent']>[0];

type ModelProxy = {
    generateContent: (params: Omit<GenerateContentParams, 'model'>) => ReturnType<ModelsClient['generateContent']>;
    generateContentStream: (params: Omit<GenerateContentStreamParams, 'model'>) => ReturnType<ModelsClient['generateContentStream']>;
    countTokens: (params: Omit<CountTokensParams, 'model'>) => ReturnType<ModelsClient['countTokens']>;
    embedContent: (params: Omit<EmbedContentParams, 'model'>) => ReturnType<ModelsClient['embedContent']>;
};

const clientCache = new Map<string, GoogleGenAI>();
const modelCache = new Map<string, ModelProxy>();

const normalizeKey = (apiKey: string) => apiKey?.trim();

const getClient = (apiKey: string) => {
    const normalized = normalizeKey(apiKey);
    if (!normalized) {
        throw new Error('Gemini API key is required for this operation.');
    }
    if (!clientCache.has(normalized)) {
        clientCache.set(normalized, new GoogleGenAI({ apiKey: normalized }));
    }
    return clientCache.get(normalized)!;
};

const createModelProxy = (model: string, apiKey: string): ModelProxy => {
    const client = getClient(apiKey);
    return {
        generateContent: params => client.models.generateContent({ model, ...params }),
        generateContentStream: params => client.models.generateContentStream({ model, ...params }),
        countTokens: params => client.models.countTokens({ model, ...params }),
        embedContent: params => client.models.embedContent({ model, ...params }),
    };
};

export const getModel = (model: string, apiKey: string): ModelProxy => {
    const normalizedKey = normalizeKey(apiKey);
    if (!normalizedKey) {
        throw new Error('Gemini API key is required for this operation.');
    }
    const cacheKey = `${normalizedKey}:${model}`;
    if (!modelCache.has(cacheKey)) {
        modelCache.set(cacheKey, createModelProxy(model, normalizedKey));
    }
    return modelCache.get(cacheKey)!;
};
