import { recallGlobalMemory } from './globalMemory.js';
import { recallSessionMemory } from './sessionMemory.js';
import { recallNarrativeSummary } from './narrativeMemory.js';

export type RecallResult = {
    canonFacts: string[];
    sessionFacts: string[];
    narrativeSummary: string | null;
};

/** Fatos de outra região (ruído RAG) — heurística leve por slug no texto. */
function filterFactsByRegion(facts: string[], regionSlug: string | undefined): string[] {
    if (!regionSlug?.trim()) return facts;
    const here = regionSlug.trim().toLowerCase();
    const otherRegionSlug = /\b(região|regiao|em)\s+([a-z0-9-]{4,})\b/gi;
    return facts.filter(f => {
        const lower = f.toLowerCase();
        if (lower.includes(here)) return true;
        let m: RegExpExecArray | null;
        otherRegionSlug.lastIndex = 0;
        while ((m = otherRegionSlug.exec(lower))) {
            const slug = m[2];
            if (slug && slug !== here && lower.includes(slug)) return false;
        }
        return true;
    });
}

export async function recallMemoryForTurn(opts: {
    sessionId: number;
    query: string;
    limit?: number;
    regionSlug?: string;
}): Promise<RecallResult> {
    const limit = opts.limit ?? 8;
    const [sessionFactsRaw, canonFactsRaw, narrativeSummary] = await Promise.all([
        recallSessionMemory({ sessionId: opts.sessionId, query: opts.query, limit }),
        recallGlobalMemory({ query: opts.query, limit: Math.min(limit, 6) }),
        recallNarrativeSummary(opts.sessionId),
    ]);

    const sessionFacts = filterFactsByRegion(sessionFactsRaw, opts.regionSlug).slice(0, limit);
    const canonFacts = filterFactsByRegion(canonFactsRaw, opts.regionSlug).slice(
        0,
        Math.min(limit, 6),
    );

    return { canonFacts, sessionFacts, narrativeSummary };
}
