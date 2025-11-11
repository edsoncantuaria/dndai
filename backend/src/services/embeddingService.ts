// backend/src/services/embeddingService.ts
import { getModel } from '../ai/genkit.js';

export async function embedText(text: string, apiKey: string): Promise<number[]> {
    const content = typeof text === 'string' ? text.trim() : '';
    if (!content || !apiKey?.trim()) return [];

    const embedModel = getModel('models/gemini-embedding-001', apiKey);
    const result = await embedModel.embedContent({
        contents: [{ role: 'user', parts: [{ text: content }] }],
    });

    return result?.embeddings?.[0]?.values ?? [];
}
