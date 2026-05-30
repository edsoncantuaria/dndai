import 'dotenv/config';

const toBoolean = (value: string | undefined, fallback = false) =>
    value === undefined ? fallback : ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());

export const penaiEnv = {
    PORT: Number(process.env.PORT) || 8071,
    DEFAULT_LOCALE: (process.env.DEFAULT_LOCALE ?? 'pt-BR').trim(),
    API_VERSION: (process.env.API_VERSION ?? 'v2').trim(),

    DATABASE_URL:
        process.env.DATABASE_URL ??
        process.env.PENAI_DATABASE_URL ??
        'postgres://penai:penai_secret@localhost:5432/penai',

    REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',

    TEMPORAL_ADDRESS: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233',
    TEMPORAL_NAMESPACE: process.env.TEMPORAL_NAMESPACE ?? 'penai',
    TEMPORAL_DISABLED: toBoolean(process.env.TEMPORAL_DISABLED, false),
    SKIP_TEMPORAL_WORKER: toBoolean(process.env.SKIP_TEMPORAL_WORKER, false),

    QDRANT_URL: process.env.QDRANT_URL ?? 'http://localhost:6333',
    QDRANT_ENABLED: toBoolean(
        process.env.QDRANT_ENABLED,
        Boolean(process.env.DATABASE_URL ?? process.env.PENAI_DATABASE_URL),
    ),
    QDRANT_VECTOR_SIZE: Number(process.env.QDRANT_VECTOR_SIZE) || 768,

    GEMINI_API_KEY: (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim(),
    JWT_SECRET: process.env.JWT_SECRET ?? 'change-me-in-development',

    PENAI_MAX_RESOURCE_MODULES: Number(process.env.PENAI_MAX_RESOURCE_MODULES) || 5,

    CORS_ALLOWED_ORIGINS: (process.env.CORS_ALLOWED_ORIGINS ?? '')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean),
} as const;

export function parseAllowedOrigins(): string[] {
    const defaults = [
        'http://localhost:9002',
        'http://127.0.0.1:9002',
        'https://dnd.cloudive.com.br',
        'http://dnd.cloudive.com.br',
        'https://rpg.edsin-server.space',
    ];
    return [...new Set([...penaiEnv.CORS_ALLOWED_ORIGINS, ...defaults])];
}
