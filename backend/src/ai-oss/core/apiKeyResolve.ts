import { getOpenRouterManager } from '../providers/OpenRouterManager.js';

export function preferServerOpenRouterKeys(): boolean {
    return ['1', 'true', 'yes', 'on'].includes(
        (process.env.OPENROUTER_PREFER_SERVER_KEYS ?? 'true').trim().toLowerCase(),
    );
}

/** Jogador, pool do servidor ou erro. */
export function hasResolvableOpenRouterKey(userKey?: string | null): boolean {
    if (userKey?.trim()) return true;
    return preferServerOpenRouterKeys() && getOpenRouterManager().hasKeys();
}

export function assertResolvableOpenRouterKey(userKey?: string | null): void {
    if (!hasResolvableOpenRouterKey(userKey)) {
        throw new Error(
            'Chave OpenRouter ausente. Defina OPENROUTER_KEY1..N no servidor ou nas Configurações.',
        );
    }
}
