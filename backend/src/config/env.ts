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
    GEMINI_API_KEY: string;
};

export const env: EnvShape = {
    PORT: Number(process.env.PORT) || 8071,
    QDRANT_URL: process.env.QDRANT_URL || 'http://localhost:6333',
    QDRANT_API_KEY: process.env.QDRANT_API_KEY || undefined,
    QDRANT_ENABLED: toBoolean(process.env.QDRANT_ENABLED, false),
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '',
};

export const assertEnv = <K extends keyof EnvShape>(key: K): EnvShape[K] => {
    const value = env[key];
    if (value === undefined || value === null || value === '') {
        throw new Error(`Environment variable "${key}" is not configured.`);
    }
    return value;
};
