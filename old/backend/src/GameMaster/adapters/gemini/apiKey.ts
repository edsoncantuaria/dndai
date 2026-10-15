import { penaiEnv } from '../../../config/penaiEnv.js';

export function isGoogleApiKey(key: string): boolean {
    const t = key.trim();
    return t.startsWith('AIza') || t.length >= 20;
}

function platformBillingEnabled(): boolean {
    const raw = process.env.AI_PLATFORM_BILLING_ENABLED;
    if (raw === undefined) return false;
    return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

function serverGeminiKey(): string {
    return (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? penaiEnv.GEMINI_API_KEY).trim();
}

/** BYOK do jogador; chave de servidor só com billing de plataforma ligado. */
export function resolveGeminiApiKey(userKey?: string | null): string {
    const user = userKey?.trim() ?? '';
    if (user && isGoogleApiKey(user)) return user;
    if (platformBillingEnabled()) return serverGeminiKey();
    return '';
}

export function hasResolvableGeminiKey(userKey?: string | null): boolean {
    return Boolean(resolveGeminiApiKey(userKey));
}
