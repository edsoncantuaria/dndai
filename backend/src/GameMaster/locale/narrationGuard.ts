/** Rejeita blocos predominantemente em inglês (exceto nomes próprios curtos). */
export function isPredominantlyEnglish(text: string): boolean {
    const trimmed = text.trim();
    if (trimmed.length < 40) return false;

    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length < 8) return false;

    const enStop = new Set([
        'the', 'and', 'you', 'your', 'with', 'that', 'this', 'from', 'into', 'what', 'when',
    ]);
    let enHits = 0;
    for (const w of words) {
        const lower = w.toLowerCase().replace(/[^a-z]/g, '');
        if (enStop.has(lower)) enHits += 1;
    }
    return enHits / words.length > 0.12;
}

export function assertNarrationPtBr(narration: string): { ok: boolean; reason?: string } {
    if (!narration?.trim()) {
        return { ok: false, reason: 'Narração vazia' };
    }
    if (isPredominantlyEnglish(narration)) {
        return { ok: false, reason: 'Narração parece estar em inglês' };
    }
    return { ok: true };
}
