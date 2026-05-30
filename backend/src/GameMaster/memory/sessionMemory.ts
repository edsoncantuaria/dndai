import { IsNull } from 'typeorm';
import { randomUUID } from 'crypto';
import { PenaiDataSource } from '../database/data-source.js';
import { SessionMemory } from '../database/entities/SessionMemory.js';
import { defaultProviders } from '../adapters/index.js';
import { bumpMemoriesOnRecall } from './decayPolicy.js';

const SESSION_COLLECTION = 'penai_session_memories';

export async function recallSessionMemory(opts: {
    sessionId: number;
    query: string;
    limit?: number;
}): Promise<string[]> {
    const limit = opts.limit ?? 8;
    const sessionRepo = PenaiDataSource.getRepository(SessionMemory);

    if (defaultProviders.vectorStore.isReady() && opts.query.trim()) {
        const vector = await defaultProviders.embedding.embed(opts.query);
        if (vector.length) {
            const hits = await defaultProviders.vectorStore.search(SESSION_COLLECTION, vector, limit, {
                sessionId: opts.sessionId,
            });
            const facts = hits.map(h => String(h.payload.text ?? '')).filter(Boolean);
            if (facts.length) {
                void bumpMemoriesOnRecall(opts.sessionId, facts).catch(() => undefined);
                return facts;
            }
        }
    }

    const rows = await sessionRepo.find({
        where: { sessionId: opts.sessionId, decayedAt: IsNull() },
        order: { importanceScore: 'DESC', createdAt: 'DESC' },
        take: limit,
    });
    const facts = rows.map(r => r.text);
    void bumpMemoriesOnRecall(opts.sessionId, facts).catch(() => undefined);
    return facts;
}

export async function storeSessionMemory(opts: {
    sessionId: number;
    text: string;
    actionSequence?: number;
}): Promise<void> {
    const trimmed = opts.text.trim().slice(0, 500);
    if (!trimmed) return;

    const repo = PenaiDataSource.getRepository(SessionMemory);
    const row = await repo.save(
        repo.create({
            sessionId: opts.sessionId,
            text: trimmed,
            locale: 'pt-BR',
            importanceScore: 55,
            lastReferencedAt: new Date(),
        }),
    );

    if (!defaultProviders.vectorStore.isReady()) return;

    const vector = await defaultProviders.embedding.embed(trimmed);
    if (!vector.length) return;

    await defaultProviders.vectorStore.upsert(SESSION_COLLECTION, randomUUID(), vector, {
        sessionId: opts.sessionId,
        memoryId: row.id,
        text: trimmed,
        actionSequence: opts.actionSequence ?? 0,
        importanceScore: row.importanceScore,
    });
}
