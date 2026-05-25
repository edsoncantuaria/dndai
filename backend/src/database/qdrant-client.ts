// backend/src/database/qdrant-client.ts
import { QdrantClient, CollectionInfo } from '@qdrant/js-client-rest';
import { env } from '../config/env.js';

let qdrantClient: QdrantClient | null = null;

if (env.QDRANT_ENABLED) {
    qdrantClient = new QdrantClient({
        url: env.QDRANT_URL,
        apiKey: env.QDRANT_API_KEY,
        timeout: 10_000,
        checkCompatibility: false,
    });
} else {
    console.warn('[QDRANT] Disabled via configuration. Semantic memory features will be skipped.');
}

export const qdrant = qdrantClient;

export const isQdrantReady = () => Boolean(qdrant);

const DEFAULT_DISTANCE = 'Cosine';
const collections = [
    { name: 'session_memories', vector_size: env.QDRANT_VECTOR_SIZE },
    { name: 'world_memories', vector_size: env.QDRANT_VECTOR_SIZE },
    { name: 'npc_profiles', vector_size: env.QDRANT_VECTOR_SIZE },
];

const extractVectorSize = (info: CollectionInfo | null): number | null => {
    if (!info) return null;
    const vectorsConfig: any = info.config?.params?.vectors;
    if (!vectorsConfig) return null;

    if (typeof vectorsConfig.size === 'number') {
        return vectorsConfig.size;
    }

    if (typeof vectorsConfig.default?.size === 'number') {
        return vectorsConfig.default.size;
    }

    if (typeof vectorsConfig === 'object') {
        const firstEntry = Object.values(vectorsConfig).find(
            (value: any) => value && typeof (value as any).size === 'number'
        ) as { size: number } | undefined;
        if (firstEntry?.size) return firstEntry.size;
    }
    return null;
};

const createCollection = async (name: string, vector_size: number) => {
    await qdrant!.createCollection(name, {
        vectors: {
            size: vector_size,
            distance: DEFAULT_DISTANCE,
        },
    });
};

export async function ensureQdrantCollections(): Promise<void> {
    if (!qdrant) {
        console.warn('[QDRANT] Skipping collection check because client is not initialized.');
        return;
    }

    for (const { name, vector_size } of collections) {
        try {
            const existing = await qdrant.getCollection(name).catch(() => null);
            if (!existing) {
                await createCollection(name, vector_size);
                console.log(`[QDRANT] Created collection: ${name}`);
                continue;
            }

            const currentSize = extractVectorSize(existing);
            if (currentSize && currentSize !== vector_size) {
                console.warn(
                    `[QDRANT] Collection "${name}" has vector size ${currentSize}, expected ${vector_size}. Recreating...`
                );
                await qdrant.deleteCollection(name);
                await createCollection(name, vector_size);
                console.log(`[QDRANT] Recreated collection with updated vector size: ${name}`);
            }
        } catch (error) {
            console.error(`[QDRANT] Failed to ensure collection "${name}":`, error);
            throw error;
        }
    }
}
