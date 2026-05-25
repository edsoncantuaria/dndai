// backend/src/services/embeddingService.ts
import {
    embedTextOpenRouter,
    isOpenRouterEmbeddingEnabled,
} from '../ai-oss/providers/openRouterEmbeddings.js';
import { getModel } from '../ai/genkit.js';

/**
 * Gera embedding vetorial para memória Qdrant.
 * Prioridade: OpenRouter (OPENROUTER_KEY_EMBEDDING + nemotron) quando AI_EMBEDDING_PROVIDER=openrouter.
 */
export async function embedText(text: string, apiKey?: string): Promise<number[]> {
    const content = typeof text === 'string' ? text.trim() : '';
    if (!content) return [];

    if (isOpenRouterEmbeddingEnabled()) {
        try {
            const result = await embedTextOpenRouter(content, apiKey);
            const expected = Number(process.env.QDRANT_VECTOR_SIZE) || 2048;
            if (result.dimension && result.dimension !== expected) {
                console.warn(
                    `[embeddingService] Dimensão ${result.dimension} ≠ QDRANT_VECTOR_SIZE=${expected}. Ajuste .env.`,
                );
            }
            return result.vector;
        } catch (err) {
            console.error('[embeddingService] OpenRouter embedding falhou:', err);
            return [];
        }
    }

    const key = apiKey?.trim();
    if (!key) return [];

    const embedModel = getModel('models/gemini-embedding-001', key);
    const result = await embedModel.embedContent({
        contents: [{ role: 'user', parts: [{ text: content }] }],
    });

    return result?.embeddings?.[0]?.values ?? [];
}
