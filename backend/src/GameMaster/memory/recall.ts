import { PenaiDataSource } from '../database/data-source.js';
import { SessionMemory } from '../database/entities/SessionMemory.js';
import { WorldMemory } from '../database/entities/WorldMemory.js';
import { NarrativeSummary } from '../database/entities/NarrativeSummary.js';
import { embedText } from '../ai/geminiEmbeddings.js';
import { isPenaiQdrantReady, searchPenaiVectors } from './qdrantPenai.js';

export type RecallResult = {
    canonFacts: string[];
    sessionFacts: string[];
    narrativeSummary: string | null;
};

export async function recallMemoryForTurn(opts: {
    sessionId: number;
    query: string;
    limit?: number;
}): Promise<RecallResult> {
    const limit = opts.limit ?? 8;
    const sessionRepo = PenaiDataSource.getRepository(SessionMemory);
    const worldRepo = PenaiDataSource.getRepository(WorldMemory);
    const summaryRepo = PenaiDataSource.getRepository(NarrativeSummary);

    let sessionFacts: string[] = [];
    let canonFacts: string[] = [];

    if (isPenaiQdrantReady() && opts.query.trim()) {
        const vector = await embedText(opts.query);
        if (vector.length) {
            const [sessionHits, canonHits] = await Promise.all([
                searchPenaiVectors('penai_session_memories', vector, limit, {
                    sessionId: opts.sessionId,
                }),
                searchPenaiVectors('penai_world_memories', vector, Math.min(limit, 6)),
            ]);
            sessionFacts = sessionHits.map(h => String(h.payload.text ?? '')).filter(Boolean);
            canonFacts = canonHits.map(h => String(h.payload.text ?? '')).filter(Boolean);
        }
    }

    if (!sessionFacts.length) {
        const rows = await sessionRepo.find({
            where: { sessionId: opts.sessionId },
            order: { createdAt: 'DESC' },
            take: limit,
        });
        sessionFacts = rows.map(r => r.text);
    }

    if (!canonFacts.length) {
        const rows = await worldRepo.find({
            order: { createdAt: 'DESC' },
            take: Math.min(limit, 6),
        });
        canonFacts = rows.map(r => r.text);
    }

    const latestSummary = await summaryRepo.findOne({
        where: { sessionId: opts.sessionId },
        order: { createdAt: 'DESC' },
    });

    return {
        canonFacts,
        sessionFacts,
        narrativeSummary: latestSummary?.summary ?? null,
    };
}
