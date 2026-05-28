/**
 * P5.4 — validação leve pós-LLM (sem chamada extra de modelo).
 * Cruza prosa com hints do motor; heurística PT/EN.
 */

export type NarrativeConsistencyResult = {
    valid: boolean;
    reason?: string;
};

const HIT_MARKERS = ['acertou', 'atinge', 'atingiu', 'golpeia', 'feriu', 'atinge o alvo', 'hit'];
const MISS_MARKERS = ['err', 'falhou', 'desvia', 'esquiva', 'miss', 'não acerta', 'nao acerta'];

function normalizeHints(hints: unknown): string[] {
    if (!Array.isArray(hints)) return [];
    return hints
        .filter((h): h is string => typeof h === 'string' && h.trim().length > 0)
        .map(h => h.toLowerCase());
}

export function extractMainNarrationText(response: {
    narration?: string;
    logEntries?: Array<{ type?: string; content?: unknown }>;
}): string {
    if (typeof response.narration === 'string' && response.narration.trim()) {
        return response.narration;
    }
    const entries = response.logEntries ?? [];
    const narration = entries.find(e => e?.type === 'narration');
    if (narration && typeof narration.content === 'string') return narration.content;
    return entries
        .map(e => (typeof e?.content === 'string' ? e.content : ''))
        .filter(Boolean)
        .join(' ');
}

/** Detecta contradição óbvia entre hint de acerto/erro do motor e prosa gerada. */
export function validateNarrativeConsistency(
    narrationText: string,
    stateHints: unknown,
): NarrativeConsistencyResult {
    const text = narrationText.toLowerCase();
    if (!text.trim()) return { valid: true };

    const hints = normalizeHints(stateHints);
    const motorSaysHit = hints.some(
        h =>
            h.includes('[motor] ataque acertou') ||
            h.includes('ataque acertou') ||
            (h.includes('[motor]') && HIT_MARKERS.some(m => h.includes(m))),
    );
    const motorSaysMiss = hints.some(
        h =>
            h.includes('[motor] ataque errou') ||
            h.includes('ataque errou') ||
            (h.includes('[motor]') && h.includes('errou')),
    );

    if (motorSaysHit && MISS_MARKERS.some(m => text.includes(m) && text.includes('ataque'))) {
        return { valid: false, reason: 'Narração sugere erro após acerto confirmado pelo motor.' };
    }
    if (motorSaysMiss && text.includes('acert') && (text.includes('golpe') || text.includes('fer'))) {
        return { valid: false, reason: 'Narração sugere acerto após falha confirmada pelo motor.' };
    }

    return { valid: true };
}

function splitSentences(text: string): string[] {
    return text
        .split(/(?<=[.!?])\s+/g)
        .map(s => s.trim())
        .filter(Boolean);
}

function sentenceLooksLikeMiss(sentence: string): boolean {
    const s = sentence.toLowerCase();
    // Conservador: só remove se tiver marcador de erro + contexto de ataque/golpe.
    const hasMiss = MISS_MARKERS.some(m => s.includes(m));
    const hasAttackContext = s.includes('ataque') || s.includes('golpe') || s.includes('acerta') || s.includes('erra');
    return hasMiss && hasAttackContext;
}

function sentenceLooksLikeHit(sentence: string): boolean {
    const s = sentence.toLowerCase();
    const hasHit = HIT_MARKERS.some(m => s.includes(m));
    const hasAttackContext = s.includes('ataque') || s.includes('golpe') || s.includes('fer');
    return hasHit && hasAttackContext;
}

export function remediateNarrationConsistency(params: {
    narrationText: string;
    stateHints: unknown;
}): { changed: boolean; text: string; note?: string } {
    const text = params.narrationText ?? '';
    const hints = normalizeHints(params.stateHints);
    const motorSaysHit = hints.some(h => h.includes('[motor] ataque acertou') || h.includes('ataque acertou'));
    const motorSaysMiss = hints.some(h => h.includes('[motor] ataque errou') || h.includes('ataque errou'));

    if (!motorSaysHit && !motorSaysMiss) return { changed: false, text };
    if (!text.trim()) return { changed: false, text };

    const sentences = splitSentences(text);
    let changed = false;
    let filtered = sentences;

    if (motorSaysHit) {
        const before = filtered.length;
        filtered = filtered.filter(s => !sentenceLooksLikeMiss(s));
        changed = changed || filtered.length !== before;
        if (changed) {
            filtered.push('Seu golpe encontra o alvo.');
            return {
                changed: true,
                text: filtered.join(' ').trim(),
                note: 'Remediação aplicada: motor confirmou acerto.',
            };
        }
    }

    if (motorSaysMiss) {
        const before = filtered.length;
        filtered = filtered.filter(s => !sentenceLooksLikeHit(s));
        changed = changed || filtered.length !== before;
        if (changed) {
            filtered.push('O ataque não conecta.');
            return {
                changed: true,
                text: filtered.join(' ').trim(),
                note: 'Remediação aplicada: motor confirmou falha.',
            };
        }
    }

    return { changed: false, text };
}
