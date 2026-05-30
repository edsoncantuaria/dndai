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

const MECHANICAL_GRANT =
    /\b(você recebe|recebes|ganha|ganhou|encontra(?:\s+\d+|\s+um|\s+uma|\s+o|\s+a)?\s*(?:\d+\s*)?(?:gp|po|moed|ouro|tesouro|espada|armadura|item|potion|poção)|sobe(?:\s+para)?\s+(?:o\s+)?nível|ganha(?:\s+\d+)?\s+xp)\b/i;

export function detectMechanicalGrantInNarration(narration: string): boolean {
    return MECHANICAL_GRANT.test(narration.trim());
}

export function assertNarrationPtBr(narration: string): { ok: boolean; reason?: string } {
    if (!narration?.trim()) {
        return { ok: false, reason: 'Narração vazia' };
    }
    if (isPredominantlyEnglish(narration)) {
        return { ok: false, reason: 'Narração parece estar em inglês' };
    }
    if (detectMechanicalGrantInNarration(narration)) {
        return { ok: false, reason: 'Narração concede recurso mecânico (ouro/item/HP/XP)' };
    }
    return { ok: true };
}
