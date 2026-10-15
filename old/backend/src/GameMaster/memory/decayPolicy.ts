import { PenaiDataSource } from '../database/data-source.js';
import { SessionMemory } from '../database/entities/SessionMemory.js';

const DECAY_STEP = 5;
const DECAY_THRESHOLD = 10;
const RECALL_BOOST = 8;

export async function decaySessionMemories(sessionId: number): Promise<number> {
    const repo = PenaiDataSource.getRepository(SessionMemory);
    const rows = await repo.find({
        where: { sessionId },
        order: { createdAt: 'ASC' },
        take: 500,
    });

    let decayed = 0;
    const now = new Date();

    for (const row of rows) {
        if (row.decayedAt) continue;
        row.importanceScore = Math.max(0, row.importanceScore - DECAY_STEP);
        if (row.importanceScore < DECAY_THRESHOLD) {
            row.decayedAt = now;
            decayed++;
        }
        await repo.save(row);
    }

    return decayed;
}

export async function bumpMemoryImportance(memoryId: string): Promise<void> {
    const repo = PenaiDataSource.getRepository(SessionMemory);
    const row = await repo.findOne({ where: { id: memoryId } });
    if (!row || row.decayedAt) return;
    row.importanceScore = Math.min(100, row.importanceScore + RECALL_BOOST);
    row.lastReferencedAt = new Date();
    await repo.save(row);
}

export async function bumpMemoriesOnRecall(sessionId: number, texts: string[]): Promise<void> {
    if (!texts.length) return;
    const repo = PenaiDataSource.getRepository(SessionMemory);
    const rows = await repo.find({
        where: { sessionId },
        order: { importanceScore: 'DESC' },
        take: 50,
    });
    const normalized = new Set(texts.map(t => t.trim().slice(0, 200)));
    for (const row of rows) {
        if (row.decayedAt) continue;
        if (!normalized.has(row.text.trim().slice(0, 200))) continue;
        row.importanceScore = Math.min(100, row.importanceScore + RECALL_BOOST);
        row.lastReferencedAt = new Date();
        await repo.save(row);
    }
}
