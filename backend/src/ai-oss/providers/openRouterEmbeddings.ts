import { OSS_EMBEDDING_MODEL } from '../constants.js';

const OPENROUTER_EMBEDDINGS_URL = 'https://openrouter.ai/api/v1/embeddings';

export type OpenRouterEmbeddingResult = {
    vector: number[];
    model: string;
    dimension: number;
};

function resolveEmbeddingApiKey(fallbackUserKey?: string): string | null {
    const dedicated = process.env.OPENROUTER_KEY_EMBEDDING?.trim();
    if (dedicated) return dedicated;
    for (let i = 1; i <= 16; i += 1) {
        const v = process.env[`OPENROUTER_KEY${i}`]?.trim();
        if (v) return v;
    }
    const bulk = process.env.OPENROUTER_KEYS?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
    if (bulk[0]) return bulk[0];
    const trimmed = fallbackUserKey?.trim();
    return trimmed || null;
}

export function isOpenRouterEmbeddingEnabled(): boolean {
    const provider = (process.env.AI_EMBEDDING_PROVIDER ?? 'openrouter').trim().toLowerCase();
    if (provider === 'gemini' || provider === 'google') return false;
    if (['1', 'true', 'yes', 'on'].includes((process.env.AI_OPENROUTER_ONLY ?? '').trim().toLowerCase())) {
        return Boolean(resolveEmbeddingApiKey());
    }
    return Boolean(resolveEmbeddingApiKey());
}

export function resolveOpenRouterEmbeddingModel(): string {
    return process.env.OPENROUTER_EMBEDDING_MODEL?.trim() || OSS_EMBEDDING_MODEL;
}

/**
 * Embeddings via OpenRouter — padrão: nvidia/llama-nemotron-embed-vl-1b-v2:free
 * Chave: OPENROUTER_KEY_EMBEDDING (não consome pool de narrativa).
 */
export async function embedTextOpenRouter(
    text: string,
    fallbackUserKey?: string,
): Promise<OpenRouterEmbeddingResult> {
    const content = text?.trim();
    if (!content) {
        return { vector: [], model: resolveOpenRouterEmbeddingModel(), dimension: 0 };
    }

    const apiKey = resolveEmbeddingApiKey(fallbackUserKey);
    if (!apiKey) {
        throw new Error(
            'OPENROUTER_KEY_EMBEDDING ou OPENROUTER_KEY1..N ausente para embeddings.',
        );
    }

    const model = resolveOpenRouterEmbeddingModel();
    const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': process.env.OPENROUTER_APP_NAME?.trim() || 'DnDAI',
    };
    const appUrl = process.env.OPENROUTER_APP_URL?.trim();
    if (appUrl) headers['HTTP-Referer'] = appUrl;

    const response = await fetch(OPENROUTER_EMBEDDINGS_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            model,
            input: content,
            encoding_format: 'float',
        }),
    });

    const data = (await response.json()) as {
        data?: Array<{ embedding?: number[] }>;
        error?: { message?: string };
    };

    if (!response.ok) {
        throw new Error(data?.error?.message ?? `OpenRouter embeddings HTTP ${response.status}`);
    }

    const vector = data?.data?.[0]?.embedding ?? [];
    if (!vector.length) {
        throw new Error('OpenRouter retornou embedding vazio.');
    }

    return {
        vector,
        model,
        dimension: vector.length,
    };
}
