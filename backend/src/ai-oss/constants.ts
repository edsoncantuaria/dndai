/** Modelo primário do motor OSS (OpenRouter). */
export const OSS_120B_MODEL = 'openai/gpt-oss-120b:free';

/** Embeddings via OpenRouter (Qdrant: 2048 dims). */
export const OSS_EMBEDDING_MODEL = 'nvidia/llama-nemotron-embed-vl-1b-v2:free';

export const OSS_EMBEDDING_DIMENSION = 2048;

export const OSS_DEFAULT_GENERATION = {
    temperature: 0.75,
    topP: 0.9,
    maxOutputTokens: 2048,
} as const;

/** Cooldown após 429 (ms). */
export const OPENROUTER_COOLDOWN_MS = 60_000;

/** Falhas consecutivas antes de circuit breaker. */
export const OPENROUTER_CIRCUIT_FAIL_THRESHOLD = 3;
