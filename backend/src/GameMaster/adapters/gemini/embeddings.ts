import { GoogleGenAI } from '@google/genai';
import { penaiEnv } from '../../../config/penaiEnv.js';
import type { EmbeddingProvider } from '../contracts.js';
import { resolveGeminiApiKey } from './apiKey.js';

const MODEL = 'gemini-embedding-001';

export function isGeminiEmbeddingEnabled(): boolean {
    return geminiEmbeddingProvider.isEnabled();
}

export async function embedTextGemini(
    text: string,
    userApiKey?: string,
): Promise<{ vector: number[]; dimension: number }> {
    const apiKey = resolveGeminiApiKey(userApiKey);
    if (!apiKey) return { vector: [], dimension: 0 };

    const client = new GoogleGenAI({ apiKey });
    const result = await client.models.embedContent({ model: MODEL, contents: text });
    const vector = result.embeddings?.[0]?.values ?? [];
    return { vector, dimension: vector.length };
}

export async function embedText(text: string, userApiKey?: string): Promise<number[]> {
    return geminiEmbeddingProvider.embed(text, userApiKey);
}

export const geminiEmbeddingProvider: EmbeddingProvider = {
    isEnabled(): boolean {
        return Boolean(resolveGeminiApiKey(''));
    },
    async embed(text: string, userApiKey?: string): Promise<number[]> {
        if (!text.trim()) return [];
        const { vector } = await embedTextGemini(text, userApiKey);
        const expected = penaiEnv.QDRANT_VECTOR_SIZE;
        if (vector.length && vector.length !== expected) {
            console.warn(`[embed] dimensão ${vector.length} ≠ QDRANT_VECTOR_SIZE=${expected}`);
        }
        return vector;
    },
};
