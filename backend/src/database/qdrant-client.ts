// backend/src/database/qdrant-client.ts
import { QdrantClient } from '@qdrant/js-client-rest';
import { env } from '../config/env.js';

let qdrantClient: QdrantClient | null = null;

if (env.QDRANT_ENABLED) {
    qdrantClient = new QdrantClient({
        url: env.QDRANT_URL,
        apiKey: env.QDRANT_API_KEY,
        timeout: 10_000,
    });
} else {
    console.warn('[QDRANT] Disabled via configuration. Semantic memory features will be skipped.');
}

export const qdrant = qdrantClient;

export const isQdrantReady = () => Boolean(qdrant);

const collections = [
    { name: 'session_memories', vector_size: 768 },
    { name: 'world_memories', vector_size: 768 },
    { name: 'npc_profiles', vector_size: 768 },
];

export async function ensureQdrantCollections(): Promise<void> {
    if (!qdrant) {
        console.warn('[QDRANT] Skipping collection check because client is not initialized.');
        return;
    }

    for (const { name, vector_size } of collections) {
        try {
            const existing = await qdrant.getCollection(name).catch(() => null);
            if (!existing) {
                await qdrant.createCollection(name, {
                    vectors: {
                        size: vector_size,
                        distance: 'Cosine',
                    },
                });
                console.log(`[QDRANT] Created collection: ${name}`);
            }
        } catch (error) {
            console.error(`[QDRANT] Failed to ensure collection "${name}":`, error);
            throw error;
        }
    }
}
