/**
 * Memória semântica em duas camadas (ambas necessárias):
 * 1. Embedding — OpenRouter `nvidia/llama-nemotron-embed-vl-1b-v2:free` (vetor 2048d)
 * 2. Qdrant — armazena/busca vetores; MySQL backlog se Qdrant ou embed falhar
 *
 * storeMemory: backlog → embed → upsert Qdrant
 * recallSimilarMemories: embed da query → search Qdrant (+ backlog pendente)
 */
import { createHash, randomUUID } from 'crypto';
import { qdrant, isQdrantReady } from '../database/qdrant-client.js';
import { embedText } from './embeddingService.js';
import { MemoryPayloadSchema, type MemoryPayload } from '../schemas/vectorSchemas.js';
import { AppDataSource } from '../database/data-source.js';
import { VectorMemoryBacklog } from '../entities/VectorMemoryBacklog.js';

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

const BACKLOG_DRAIN_LIMIT = 5;

const hashApiKey = (apiKey: string) => createHash('sha256').update(apiKey.trim()).digest('hex');

const toErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Erro desconhecido';

const getBacklogRepository = () => {
    if (!AppDataSource.isInitialized) return null;
    try {
        return AppDataSource.getRepository(VectorMemoryBacklog);
    } catch (error) {
        console.warn('[vectorMemoryService] Repositório de backlog indisponível:', error);
        return null;
    }
};

const persistBacklogEntry = async (
    entry: Pick<VectorMemoryBacklog, 'id' | 'collection' | 'text' | 'metadata' | 'apiKeyHash'>,
) => {
    const repository = getBacklogRepository();
    if (!repository) return;
    await repository.save({
        ...entry,
        embedded: false,
        embeddedAt: null,
        lastError: null,
        retryCount: 0,
    });
};

const markBacklogEmbedded = async (id: string) => {
    const repository = getBacklogRepository();
    if (!repository) return;
    await repository.update(
        { id },
        {
            embedded: true,
            embeddedAt: new Date(),
            lastError: null,
        },
    );
};

const flagBacklogError = async (id: string, error: unknown) => {
    const repository = getBacklogRepository();
    if (!repository) return;
    const message = toErrorMessage(error).slice(0, 1000);
    await repository
        .createQueryBuilder()
        .update(VectorMemoryBacklog)
        .set({
            embedded: false,
            embeddedAt: null,
            lastError: message,
            retryCount: () => 'retryCount + 1',
        })
        .where({ id })
        .execute();
};

const fetchPendingBacklog = async (
    collection: string,
    filter: QdrantFilter | undefined,
    limit: number,
): Promise<MemoryPayload[]> => {
    const repository = getBacklogRepository();
    if (!repository || limit <= 0) return [];

    const queryBuilder = repository
        .createQueryBuilder('memory')
        .where('memory.collection = :collection', { collection })
        .andWhere('memory.embedded = false')
        .orderBy('memory.createdAt', 'DESC')
        .take(limit);

    if (filter) {
        Object.entries(filter).forEach(([key, value], index) => {
            if (!/^[a-zA-Z0-9_]+$/.test(key)) return;
            queryBuilder.andWhere(
                `JSON_UNQUOTE(JSON_EXTRACT(memory.metadata, '$.${key}')) = :filterValue${index}`,
                { [`filterValue${index}`]: String(value) },
            );
        });
    }

    const rows = await queryBuilder.getMany();
    return rows.map(row => {
        const metadata = { ...(row.metadata as Record<string, unknown>) };
        if (!metadata.text) {
            metadata.text = row.text;
        }
        return MemoryPayloadSchema.parse(metadata);
    });
};

const processPendingBacklog = async (collection: string, apiKeyHash: string, apiKey: string) => {
    if (!isQdrantReady()) return;
    const repository = getBacklogRepository();
    if (!repository) return;

    const pending = await repository.find({
        where: { collection, embedded: false, apiKeyHash },
        order: { createdAt: 'ASC' },
        take: BACKLOG_DRAIN_LIMIT,
    });

    for (const entry of pending) {
        try {
            const metadata = MemoryPayloadSchema.parse(entry.metadata);
            const text = metadata.text || entry.text;
            if (!text?.trim()) {
                await markBacklogEmbedded(entry.id);
                continue;
            }

            const vector = await embedText(text, apiKey);
            if (!vector.length) {
                await flagBacklogError(entry.id, 'Embedding vazio retornado durante reprocessamento.');
                continue;
            }

            await qdrant!.upsert(collection, {
                wait: false,
                points: [
                    {
                        id: metadata.id,
                        vector,
                        payload: metadata,
                    },
                ],
            });

            await markBacklogEmbedded(entry.id);
        } catch (error) {
            await flagBacklogError(entry.id, error);
        }
    }
};

export type StoreMemoryOptions = {
    /** false = só backlog MySQL (política de cota). */
    embed?: boolean;
    reason?: string;
};

export async function storeMemory(
    collection: string,
    text: string,
    metadata: Partial<MemoryPayload>,
    apiKey: string,
    options?: StoreMemoryOptions,
): Promise<void> {
    if (!apiKey?.trim() || !text?.trim()) return;

    const trimmedKey = apiKey.trim();
    const payload = MemoryPayloadSchema.parse({
        id: metadata.id ?? randomUUID(),
        timestamp: metadata.timestamp ?? Date.now(),
        ...metadata,
        text,
    });

    const apiKeyHash = hashApiKey(trimmedKey);
    const shouldEmbed = options?.embed !== false;

    await persistBacklogEntry({
        id: payload.id,
        collection,
        text,
        metadata: payload,
        apiKeyHash,
    });

    if (!shouldEmbed) {
        return;
    }

    if (!isQdrantReady()) {
        await flagBacklogError(payload.id, 'Qdrant indisponível no momento.');
        return;
    }

    try {
        const vector = await embedText(text, trimmedKey);
        if (!vector.length) {
            await flagBacklogError(payload.id, 'Embedding vazio retornado pelo provedor.');
            return;
        }

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

        await markBacklogEmbedded(payload.id);
        await processPendingBacklog(collection, apiKeyHash, trimmedKey);
    } catch (error) {
        await flagBacklogError(payload.id, error);
        throw error;
    }
}

interface RecallMemoryOptions {
    apiKey: string;
    limit?: number;
    filter?: QdrantFilter;
    /** false = só backlog pendente (sem chamada de embedding). */
    semanticSearch?: boolean;
}

export async function recallSimilarMemories(
    collection: string,
    query: string,
    options: RecallMemoryOptions,
): Promise<MemoryPayload[]> {
    const { apiKey, limit = 5, filter, semanticSearch = true } = options;
    const fallbackMemories = await fetchPendingBacklog(collection, filter, limit);
    if (!apiKey?.trim() || !query?.trim()) return fallbackMemories;
    if (!semanticSearch || !isQdrantReady()) return fallbackMemories;

    const trimmedKey = apiKey.trim();
    const apiKeyHash = hashApiKey(trimmedKey);
    await processPendingBacklog(collection, apiKeyHash, trimmedKey);

    const vector = await embedText(query, trimmedKey);
    if (!vector.length) return fallbackMemories;

    const response = await qdrant!.search(collection, {
        vector,
        limit,
        with_payload: true,
        filter: buildFilter(filter),
    });

    const payloads = response
        .map(result => result.payload)
        .filter((payload): payload is MemoryPayload => !!payload)
        .map(payload => MemoryPayloadSchema.parse(payload));

    const combined: MemoryPayload[] = [...fallbackMemories];
    for (const payload of payloads) {
        if (combined.some(existing => existing.id === payload.id)) continue;
        combined.push(payload);
        if (combined.length >= limit) break;
    }

    return combined.slice(0, limit);
}
