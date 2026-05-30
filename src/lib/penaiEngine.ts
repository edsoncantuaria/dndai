const STORAGE_PREFIX = 'cda:session:';

/** PENAI é o único motor de gameplay — legado MySQL/Express descontinuado. */
export function markSessionAsPenai(sessionId: number): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(`${STORAGE_PREFIX}${sessionId}:engine`, 'penai');
    } catch {
        /* ignore */
    }
}

export function isPenaiDefaultEngine(): boolean {
    return true;
}

export function isPenaiSession(_sessionId: number | null | undefined): boolean {
    return true;
}
