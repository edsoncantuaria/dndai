import { QdrantClient } from '@qdrant/js-client-rest';
import { penaiEnv } from '../../../config/penaiEnv.js';
import type { VectorStore } from '../contracts.js';

let client: QdrantClient | null = null;

export const COLLECTIONS = [
    'penai_session_memories',
    'penai_world_memories',
    'penai_npc_profiles',
] as const;

export type VectorCollection = (typeof COLLECTIONS)[number];

function getClient(): QdrantClient | null {
    if (!penaiEnv.QDRANT_ENABLED) return null;
    if (!client) {
        client = new QdrantClient({
            url: penaiEnv.QDRANT_URL,
            timeout: 10_000,
            checkCompatibility: false,
        });
    }
    return client;
}

export const qdrantVectorStore: VectorStore = {
    isReady(): boolean {
        return penaiEnv.QDRANT_ENABLED && Boolean(client ?? penaiEnv.QDRANT_URL);
    },
    async ensureCollections(): Promise<void> {
        const qdrant = getClient();
        if (!qdrant) return;
        const targetSize = penaiEnv.QDRANT_VECTOR_SIZE;
        for (const name of COLLECTIONS) {
            const existing = await qdrant.getCollection(name).catch(() => null);
            const currentSize = existing
                ? Number(
                      (existing as { config?: { params?: { vectors?: { size?: number } } } })
                          .config?.params?.vectors?.size ?? 0,
                  )
                : 0;
            if (existing && currentSize && currentSize !== targetSize) {
                console.warn(
                    `[Qdrant] Recriando ${name}: dim ${currentSize} → ${targetSize}`,
                );
                await qdrant.deleteCollection(name);
            }
            if (!existing || (currentSize && currentSize !== targetSize)) {
                await qdrant.createCollection(name, {
                    vectors: { size: targetSize, distance: 'Cosine' },
                });
                console.log(`[Qdrant] Coleção criada: ${name} (${targetSize}d)`);
            }
        }
    },
    async upsert(collection, pointId, vector, payload): Promise<void> {
        const qdrant = getClient();
        if (!qdrant || !vector.length) return;
        if (vector.length !== penaiEnv.QDRANT_VECTOR_SIZE) return;
        try {
            await qdrant.upsert(collection, {
                wait: true,
                points: [{ id: pointId, vector, payload }],
            });
        } catch (err) {
            console.warn(`[Qdrant] upsert ${collection} falhou:`, err);
        }
    },
    async search(collection, vector, limit, filter) {
        const qdrant = getClient();
        if (!qdrant || !vector.length) return [];
        if (vector.length !== penaiEnv.QDRANT_VECTOR_SIZE) return [];
        const must = filter
            ? Object.entries(filter).map(([key, value]) => ({ key, match: { value } }))
            : undefined;
        try {
            const response = await qdrant.search(collection, {
                vector,
                limit,
                with_payload: true,
                filter: must ? { must } : undefined,
            });
            return response.map(hit => ({
                id: String(hit.id),
                score: hit.score ?? 0,
                payload: (hit.payload ?? {}) as Record<string, unknown>,
            }));
        } catch (err) {
            console.warn(`[Qdrant] search ${collection} falhou:`, err);
            return [];
        }
    },
};

/** @deprecated use qdrantVectorStore.isReady() */
export function isPenaiQdrantReady(): boolean {
    return qdrantVectorStore.isReady();
}

/** @deprecated use qdrantVectorStore.ensureCollections() */
export async function ensurePenaiQdrantCollections(): Promise<void> {
    return qdrantVectorStore.ensureCollections();
}

/** @deprecated use qdrantVectorStore.upsert() */
export async function upsertPenaiVector(
    collection: VectorCollection,
    pointId: string,
    vector: number[],
    payload: Record<string, unknown>,
): Promise<void> {
    return qdrantVectorStore.upsert(collection, pointId, vector, payload);
}

/** @deprecated use qdrantVectorStore.search() */
export async function searchPenaiVectors(
    collection: VectorCollection,
    vector: number[],
    limit: number,
    filter?: Record<string, string | number>,
) {
    return qdrantVectorStore.search(collection, vector, limit, filter);
}
