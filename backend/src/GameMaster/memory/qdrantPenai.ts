import { QdrantClient } from '@qdrant/js-client-rest';
import { penaiEnv } from '../../config/penaiEnv.js';

let client: QdrantClient | null = null;

const COLLECTIONS = ['penai_session_memories', 'penai_world_memories', 'penai_npc_profiles'] as const;

export function isPenaiQdrantReady(): boolean {
    return penaiEnv.QDRANT_ENABLED && Boolean(client ?? penaiEnv.QDRANT_URL);
}

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

export async function ensurePenaiQdrantCollections(): Promise<void> {
    const qdrant = getClient();
    if (!qdrant) return;

    for (const name of COLLECTIONS) {
        const existing = await qdrant.getCollection(name).catch(() => null);
        if (!existing) {
            await qdrant.createCollection(name, {
                vectors: {
                    size: penaiEnv.QDRANT_VECTOR_SIZE,
                    distance: 'Cosine',
                },
            });
            console.log(`[PENAI][Qdrant] Coleção criada: ${name}`);
        }
    }
}

export async function upsertPenaiVector(
    collection: (typeof COLLECTIONS)[number],
    pointId: string,
    vector: number[],
    payload: Record<string, unknown>,
): Promise<void> {
    const qdrant = getClient();
    if (!qdrant || !vector.length) return;

    await qdrant.upsert(collection, {
        wait: true,
        points: [{ id: pointId, vector, payload }],
    });
}

export async function searchPenaiVectors(
    collection: (typeof COLLECTIONS)[number],
    vector: number[],
    limit: number,
    filter?: Record<string, string | number>,
): Promise<Array<{ id: string; score: number; payload: Record<string, unknown> }>> {
    const qdrant = getClient();
    if (!qdrant || !vector.length) return [];

    const must = filter
        ? Object.entries(filter).map(([key, value]) => ({
              key,
              match: { value },
          }))
        : undefined;

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
}
