// backend/src/services/vectorMemoryService.ts
import { randomUUID } from 'crypto';
import { qdrant, isQdrantReady } from '../database/qdrant-client.js';
import { embedText } from './embeddingService.js';
import { MemoryPayloadSchema, type MemoryPayload } from '../schemas/vectorSchemas.js';

type QdrantFilter = Record<string, string | number | boolean>;

const buildFilter = (filter?: QdrantFilter) => {
    if (!filter) return undefined;
    return {
        must: Object.entries(filter).map(([key, value]) => ({
            key,
            match: { value },
        })),
    };
};

export async function storeMemory(
    collection: string,
    text: string,
    metadata: Partial<MemoryPayload>,
    apiKey: string,
): Promise<void> {
    if (!isQdrantReady() || !apiKey?.trim()) return;
    if (!text?.trim()) return;

    const payload = MemoryPayloadSchema.parse({
        id: metadata.id ?? randomUUID(),
        timestamp: metadata.timestamp ?? Date.now(),
        ...metadata,
        text,
    });

    const vector = await embedText(text, apiKey);
    if (!vector.length) return;

    await qdrant!.upsert(collection, {
        wait: false,
        points: [
            {
                id: payload.id,
                vector,
                payload,
            },
        ],
    });
}

interface RecallMemoryOptions {
    apiKey: string;
    limit?: number;
    filter?: QdrantFilter;
}

export async function recallSimilarMemories(
    collection: string,
    query: string,
    options: RecallMemoryOptions,
): Promise<MemoryPayload[]> {
    const { apiKey, limit = 5, filter } = options;
    if (!isQdrantReady() || !apiKey?.trim()) return [];
    if (!query?.trim()) return [];

    const vector = await embedText(query, apiKey);
    if (!vector.length) return [];

    const response = await qdrant!.search(collection, {
        vector,
        limit,
        with_payload: true,
        filter: buildFilter(filter),
    });

    return response
        .map(result => result.payload)
        .filter((payload): payload is MemoryPayload => !!payload)
        .map(payload => MemoryPayloadSchema.parse(payload));
}
