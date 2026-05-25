/**
 * @deprecated Legado — seleção Gemini/OpenRouter. Novo código: `ai-oss/providers/`.
 */
import { GoogleGenAI } from '@google/genai';
import { OSS_120B_MODEL } from '../ai-oss/constants.js';
import { createModelAdapter as createGeminiModelAdapter } from './client.js';
import { createOpenRouterAdapter, normalizeOpenRouterModelId } from './providers/openRouterAdapter.js';
import type { ModelAdapter } from './providers/types.js';

export type AiProviderId = 'gemini' | 'openrouter';

export const OPENROUTER_DEFAULT_FAILOVER_CHAIN = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'qwen/qwen3-next-80b-a3b-instruct:free',
    'openai/gpt-oss-120b:free',
    'nousresearch/hermes-3-llama-3.1-405b:free',
] as const;

const GEMINI_FAILOVER_TAIL = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'] as const;

export function resolveAiProvider(modelName: string): AiProviderId {
    const forced = (process.env.AI_PROVIDER ?? '').trim().toLowerCase();
    if (forced === 'openrouter' || forced === 'or') return 'openrouter';
    if (forced === 'gemini' || forced === 'google') return 'gemini';

    const lower = modelName.trim().toLowerCase();
    if (lower.startsWith('or:')) return 'openrouter';
    if (lower.includes(':free')) return 'openrouter';
    if (lower.includes('/') && !lower.startsWith('models/')) return 'openrouter';
    return 'gemini';
}

export function resolveDefaultFailoverChain(): string[] {
    const fromEnv = (process.env.AI_FAILOVER_CHAIN ?? '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    if (fromEnv.length) return fromEnv;

    const provider = (process.env.AI_PROVIDER ?? 'openrouter').toLowerCase();
    const openRouterOnly =
        provider === 'openrouter' ||
        ['1', 'true', 'yes', 'on'].includes(
            (process.env.AI_OPENROUTER_ONLY ?? '').trim().toLowerCase(),
        );

    if (provider === 'gemini' || provider === 'google') {
        return ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'];
    }
    if (openRouterOnly) {
        return [OSS_120B_MODEL];
    }
    return [...OPENROUTER_DEFAULT_FAILOVER_CHAIN, ...GEMINI_FAILOVER_TAIL];
}

export function resolveGeminiFallbackApiKey(userApiKey: string): string {
    const server = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim();
    if (server) return server;
    return userApiKey.trim();
}

export function createGameplayModelAdapter(userApiKey: string, modelName: string): ModelAdapter {
    const provider = resolveAiProvider(modelName);
    if (provider === 'openrouter') {
        return createOpenRouterAdapter(userApiKey, normalizeOpenRouterModelId(modelName));
    }
    const geminiDisabled = ['1', 'true', 'yes', 'on'].includes(
        (process.env.AI_OPENROUTER_ONLY ?? '').trim().toLowerCase(),
    );
    if (geminiDisabled) {
        throw new Error(
            `Modelo "${modelName}" requer Gemini, desativado (AI_OPENROUTER_ONLY). Use ${OSS_120B_MODEL}.`,
        );
    }
    const geminiKey = resolveGeminiFallbackApiKey(userApiKey);
    if (!geminiKey) {
        throw new Error('Chave Gemini ausente. Use modelo OpenRouter ou defina OPENROUTER_KEY1..N.');
    }
    const genAI = new GoogleGenAI({ apiKey: geminiKey });
    return createGeminiModelAdapter(genAI, modelName);
}

export function apiKeyRequiredMessage(modelName: string): string {
    return resolveAiProvider(modelName) === 'openrouter'
        ? 'Chave de API do OpenRouter não configurada. Crie em openrouter.ai/keys e adicione nas configurações.'
        : 'Chave de API do Google não configurada. Por favor, adicione sua chave nas configurações.';
}
