import { PenaiDataSource } from '../database/data-source.js';
import { WorldMemory } from '../database/entities/WorldMemory.js';
import { defaultProviders } from '../adapters/index.js';

const WORLD_COLLECTION = 'penai_world_memories';

export async function recallGlobalMemory(opts: {
    query: string;
    limit?: number;
}): Promise<string[]> {
    const limit = opts.limit ?? 6;
    const worldRepo = PenaiDataSource.getRepository(WorldMemory);

    if (defaultProviders.vectorStore.isReady() && opts.query.trim()) {
        const vector = await defaultProviders.embedding.embed(opts.query);
        if (vector.length) {
            const hits = await defaultProviders.vectorStore.search(WORLD_COLLECTION, vector, limit);
            const facts = hits.map(h => String(h.payload.text ?? '')).filter(Boolean);
            if (facts.length) return facts;
        }
    }

    const rows = await worldRepo.find({ order: { createdAt: 'DESC' }, take: limit });
    return rows.map(r => r.text);
}

export async function storeGlobalMemory(opts: {
    sessionId: number;
    text: string;
    regionSlug?: string | null;
}): Promise<void> {
    const trimmed = opts.text.trim().slice(0, 500);
    if (!trimmed || !defaultProviders.vectorStore.isReady()) return;

    const vector = await defaultProviders.embedding.embed(trimmed);
    if (!vector.length) return;

    const { randomUUID } = await import('crypto');
    await defaultProviders.vectorStore.upsert(WORLD_COLLECTION, randomUUID(), vector, {
        sessionId: opts.sessionId,
        regionSlug: opts.regionSlug ?? null,
        text: trimmed,
    });
}
