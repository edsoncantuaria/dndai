/** Chave única do JWT no browser — sempre `token`, nunca `authToken`. */
export const AUTH_TOKEN_STORAGE_KEY = 'token';

export function getStoredAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    return token?.trim() ? token : null;
}

export function setStoredAuthToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

export function clearStoredAuthToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}
