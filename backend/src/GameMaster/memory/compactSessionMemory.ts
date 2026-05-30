import { PenaiDataSource } from '../database/data-source.js';
import { SessionMemory } from '../database/entities/SessionMemory.js';
import { decaySessionMemories } from './decayPolicy.js';
import { saveNarrativeSummary } from './narrativeMemory.js';
import { summarizeSessionMemories } from '../adapters/gemini/summarizer.js';

export async function compactSessionMemory(input: {
    sessionId: number;
    fromActionSequence: number;
    toActionSequence: number;
}): Promise<string> {
    const decayed = await decaySessionMemories(input.sessionId);
    const memRepo = PenaiDataSource.getRepository(SessionMemory);
    const rows = await memRepo.find({
        where: { sessionId: input.sessionId },
        order: { createdAt: 'ASC' },
        take: 24,
    });

    if (!rows.length) return 'sem_memorias';

    const { summary, source } = await summarizeSessionMemories({
        sessionId: input.sessionId,
        fromActionSequence: input.fromActionSequence,
        toActionSequence: input.toActionSequence,
        memories: rows.map(r => r.text),
    });

    if (!summary.trim()) return 'sem_resumo';

    await saveNarrativeSummary({
        sessionId: input.sessionId,
        summary,
        fromActionSequence: input.fromActionSequence,
        toActionSequence: input.toActionSequence,
    });

    return `compactado:${rows.length}:decayed:${decayed}:source:${source}`;
}
