const openedKey = (sessionId: number) => `dndai:session-opened:${sessionId}`;

export function hasSessionBeenOpened(sessionId: number): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return sessionStorage.getItem(openedKey(sessionId)) === '1';
    } catch {
        return false;
    }
}

export function markSessionOpened(sessionId: number): void {
    if (typeof window === 'undefined') return;
    try {
        sessionStorage.setItem(openedKey(sessionId), '1');
    } catch {
        /* ignore quota / private mode */
    }
}
