type CacheEntry = {
    systemInstruction: string;
    expiresAt: number;
};

const store = new Map<string, CacheEntry>();

const DEFAULT_TTL_MS = Number(process.env.OSS_PROMPT_CACHE_TTL_MS ?? 900_000);

export function isPromptCacheEnabled(): boolean {
    return !['0', 'false', 'no', 'off'].includes(
        (process.env.OSS_PROMPT_CACHE ?? 'true').trim().toLowerCase(),
    );
}

export function buildPromptCacheKey(parts: {
    sessionId?: string;
    regionSlug?: string;
    stateVersion?: number | string;
    combatActive?: boolean;
    engine?: string;
}): string {
    const session = parts.sessionId ?? 'anon';
    const region = parts.regionSlug ?? 'none';
    const version = parts.stateVersion ?? 0;
    const combat = parts.combatActive ? 'combat' : 'explore';
    const engine = parts.engine ?? process.env.AI_ENGINE ?? 'oss';
    return `oss:prompt:${engine}:${session}:${region}:v${version}:${combat}`;
}

export function getCachedSystemInstruction(key: string): string | null {
    if (!isPromptCacheEnabled()) return null;
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
        store.delete(key);
        return null;
    }
    return entry.systemInstruction;
}

export function setCachedSystemInstruction(
    key: string,
    systemInstruction: string,
    ttlMs = DEFAULT_TTL_MS,
): void {
    if (!isPromptCacheEnabled()) return;
    store.set(key, {
        systemInstruction,
        expiresAt: Date.now() + ttlMs,
    });
}

export function invalidatePromptCacheForSession(sessionId: string): void {
    const prefix = `oss:prompt:`;
    for (const key of store.keys()) {
        if (key.includes(`:${sessionId}:`)) store.delete(key);
    }
    void prefix;
}

export function clearPromptCacheForTests(): void {
    store.clear();
}
