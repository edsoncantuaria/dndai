import './loadPenaiDotenv.js';
import { AI_PRODUCT } from './aiProductDefaults.js';

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
    /** gemini-embedding-001 → 3072; manter alinhado às coleções Qdrant */
    QDRANT_VECTOR_SIZE: Number(process.env.QDRANT_VECTOR_SIZE) || 3072,

    GEMINI_API_KEY: (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim(),
    /** Modelo structured output (bootstrap mundial, narração, etc.). */
    GEMINI_MODEL: (
        process.env.GEMINI_MODEL ??
        process.env.AI_DEFAULT_MODEL ??
        AI_PRODUCT.defaultModel
    ).trim(),
    /** Geração structured em lote (NPCs canônicos, bootstrap facções/economia/quests). */
    GEMINI_GENERATION_MODEL: (
        process.env.GEMINI_GENERATION_MODEL ??
        process.env.GEMINI_LITE_MODEL ??
        'gemini-2.5-flash'
    ).trim(),
    /** Logs verbosos do turno (WS, motor, Gemini). Dev: ligado; prod: só com PENAI_PIPELINE_LOG=1 ou AI_DEBUG_LOGS=1 */
    PENAI_PIPELINE_LOG: toBoolean(process.env.PENAI_PIPELINE_LOG, process.env.NODE_ENV !== 'production'),

    /**
     * Tentativas Gemini structured por chamada (1 = sem retry — evita empilhar tokens em 429).
     * @default 1
     */
    GEMINI_MAX_ATTEMPTS: Math.max(1, Number(process.env.GEMINI_MAX_ATTEMPTS) || 1),

    /**
     * Tentativas de narração no turnPipeline (validação pt-BR / erro de rede).
     * @default 1
     */
    PENAI_NARRATION_MAX_ATTEMPTS: Math.max(1, Number(process.env.PENAI_NARRATION_MAX_ATTEMPTS) || 1),

    /**
     * Segunda chamada Gemini para actionOptions pós-narração.
     * Default false — usa registry mecânico (`contextualActionOptions`).
     */
    PENAI_ACTION_OPTIONS_LLM: toBoolean(process.env.PENAI_ACTION_OPTIONS_LLM, false),
    JWT_SECRET: process.env.JWT_SECRET ?? 'change-me-in-development',

    PENAI_MAX_RESOURCE_MODULES: Number(process.env.PENAI_MAX_RESOURCE_MODULES) || 5,

    /** Indexar narração bruta no Qdrant global (anti-alucinação: default false). */
    PENAI_NARRATION_TO_GLOBAL_RAG: toBoolean(process.env.PENAI_NARRATION_TO_GLOBAL_RAG, false),

    CORS_ALLOWED_ORIGINS: (process.env.CORS_ALLOWED_ORIGINS ?? '')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean),
} as const;

export function parseAllowedOrigins(): string[] {
    const defaults = [
        'http://localhost:9002',
        'http://127.0.0.1:9002',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'https://dnd.cloudive.com.br',
        'http://dnd.cloudive.com.br',
        'https://rpg.edsin-server.space',
    ];
    return [...new Set([...penaiEnv.CORS_ALLOWED_ORIGINS, ...defaults])];
}

/** Em dev, aceita qualquer origem na LAN (ex.: http://192.168.x.x:9002). */
export function isDevLanOrigin(origin: string): boolean {
    if (process.env.NODE_ENV === 'production') return false;
    return /^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(
        origin,
    );
}
