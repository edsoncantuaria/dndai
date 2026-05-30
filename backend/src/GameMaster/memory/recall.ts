import { recallGlobalMemory } from './globalMemory.js';
import { recallSessionMemory } from './sessionMemory.js';
import { recallNarrativeSummary } from './narrativeMemory.js';

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
    const [sessionFacts, canonFacts, narrativeSummary] = await Promise.all([
        recallSessionMemory({ sessionId: opts.sessionId, query: opts.query, limit }),
        recallGlobalMemory({ query: opts.query, limit: Math.min(limit, 6) }),
        recallNarrativeSummary(opts.sessionId),
    ]);

    return { canonFacts, sessionFacts, narrativeSummary };
}
