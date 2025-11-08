// backend/src/config/env.ts
import 'dotenv/config';

const toBoolean = (value: string | undefined, fallback = false) => {
    if (value === undefined) return fallback;
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

type EnvShape = {
    PORT: number;
    QDRANT_URL: string;
    QDRANT_API_KEY?: string;
    QDRANT_ENABLED: boolean;
    QDRANT_VECTOR_SIZE: number;
    GEMINI_API_KEY: string;
    AI_DEBUG_LOGS: boolean;
    CHARACTER_CACHE_ENABLED: boolean;
};

export const env: EnvShape = {
    PORT: Number(process.env.PORT) || 8071,
    QDRANT_URL: process.env.QDRANT_URL || 'http://localhost:6333',
    QDRANT_API_KEY: process.env.QDRANT_API_KEY || undefined,
    QDRANT_ENABLED: toBoolean(process.env.QDRANT_ENABLED, false),
    QDRANT_VECTOR_SIZE: Number(process.env.QDRANT_VECTOR_SIZE) || 3072,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
    AI_DEBUG_LOGS: toBoolean(process.env.AI_DEBUG_LOGS, false),
    CHARACTER_CACHE_ENABLED: toBoolean(process.env.CHARACTER_CACHE_ENABLED, false),
};

export const assertEnv = <K extends keyof EnvShape>(key: K): EnvShape[K] => {
    const value = env[key];
    if (value === undefined || value === null || value === '') {
        throw new Error(`Environment variable "${key}" is not configured.`);
    }
    return value;
};
