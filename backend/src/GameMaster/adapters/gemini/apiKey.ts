import { penaiEnv } from '../../../config/penaiEnv.js';

export function isGoogleApiKey(key: string): boolean {
    const t = key.trim();
    return t.startsWith('AIza') || t.length >= 20;
}

export function resolveGeminiApiKey(userKey?: string | null): string {
    const user = userKey?.trim() ?? '';
    if (user && isGoogleApiKey(user)) return user;
    return penaiEnv.GEMINI_API_KEY;
}

export function hasResolvableGeminiKey(userKey?: string | null): boolean {
    return Boolean(resolveGeminiApiKey(userKey));
}
