/** P2.2 — nível de riqueza narrativa (tokens / TTS / stream). */
export type NarrativeLevel = 'ultra-compact' | 'compact' | 'standard' | 'cinematic';

export function resolveNarrativeLevel(playerAction?: string, combatActive?: boolean): NarrativeLevel {
    const fromEnv = process.env.NARRATIVE_LEVEL?.trim().toLowerCase();
    if (fromEnv && ['ultra-compact', 'compact', 'standard', 'cinematic'].includes(fromEnv)) {
        return fromEnv as NarrativeLevel;
    }
    const action = playerAction?.toLowerCase() ?? '';
    if (/viaj|descanso|acamp|marcha/.test(action)) return 'compact';
    if (combatActive) return 'standard';
    if (/boss|chefe|dragão|confronto final/.test(action)) return 'cinematic';
    return 'standard';
}

export function maxNarrationCharsForLevel(level: NarrativeLevel): number {
    switch (level) {
        case 'ultra-compact':
            return 400;
        case 'compact':
            return 700;
        case 'cinematic':
            return 1200;
        default:
            return 900;
    }
}
