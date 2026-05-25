export type AntiLoopResult = {
    repetitive: boolean;
    score: number;
    hint?: string;
};

const normalize = (text: string) =>
    text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

/**
 * Detecta narração muito parecida com o log recente (loop).
 */
export function detectNarrationLoop(narration: string, recentLog?: string): AntiLoopResult {
    const narr = normalize(narration);
    const log = normalize(recentLog ?? '');
    if (!narr || narr.length < 40 || !log) {
        return { repetitive: false, score: 0 };
    }

    const snippet = narr.slice(0, Math.min(120, narr.length));
    if (snippet.length >= 30 && log.includes(snippet)) {
        return {
            repetitive: true,
            score: 0.92,
            hint: 'Evite repetir frases já presentes no LOG_RECENTE. Avance a cena com consequência nova.',
        };
    }

    const narrWords = new Set(narr.split(' ').filter(w => w.length > 4));
    const logWords = log.split(' ').filter(w => w.length > 4);
    if (!narrWords.size || !logWords.length) {
        return { repetitive: false, score: 0 };
    }

    let overlap = 0;
    for (const w of logWords) {
        if (narrWords.has(w)) overlap += 1;
    }
    const score = overlap / Math.max(narrWords.size, 1);
    if (score > 0.72) {
        return {
            repetitive: true,
            score,
            hint: 'Narração muito similar ao turno anterior. Introduza novo detalhe sensorial ou consequência.',
        };
    }

    return { repetitive: false, score };
}
