import { randomUUID } from 'crypto';
import { PenaiDataSource } from '../database/data-source.js';
import { SessionMemory } from '../database/entities/SessionMemory.js';
import { embedText } from '../ai/geminiEmbeddings.js';
import { isPenaiQdrantReady, upsertPenaiVector } from './qdrantPenai.js';

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
        }),
    );

    if (!isPenaiQdrantReady()) return;

    const vector = await embedText(trimmed);
    if (!vector.length) return;

    const pointId = randomUUID();
    await upsertPenaiVector('penai_session_memories', pointId, vector, {
        sessionId: opts.sessionId,
        memoryId: row.id,
        text: trimmed,
        actionSequence: opts.actionSequence ?? 0,
    });
}

export async function storeWorldMemory(opts: {
    sessionId: number;
    text: string;
    regionSlug?: string | null;
}): Promise<void> {
    const trimmed = opts.text.trim().slice(0, 500);
    if (!trimmed || !isPenaiQdrantReady()) return;

    const vector = await embedText(trimmed);
    if (!vector.length) return;

    const pointId = randomUUID();
    await upsertPenaiVector('penai_world_memories', pointId, vector, {
        sessionId: opts.sessionId,
        regionSlug: opts.regionSlug ?? null,
        text: trimmed,
    });
}
