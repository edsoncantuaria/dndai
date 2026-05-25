/**
 * Registro plugável de provedores de inferência (Fase 4).
 * Hoje: OpenRouter (primário) e Gemini (legado / homebrew).
 */
import {
    createGameplayModelAdapter,
    resolveAiProvider,
    type AiProviderId,
} from '../../ai/providerFactory.js';
import type { ModelAdapter } from '../../ai/providers/types.js';

export type RegisteredProvider = {
    id: AiProviderId;
    label: string;
    createAdapter: (userApiKey: string, model: string) => ModelAdapter;
};

const REGISTRY: RegisteredProvider[] = [
    {
        id: 'openrouter',
        label: 'OpenRouter',
        createAdapter: (userApiKey, model) => createGameplayModelAdapter(userApiKey, model),
    },
    {
        id: 'gemini',
        label: 'Google Gemini',
        createAdapter: (userApiKey, model) => createGameplayModelAdapter(userApiKey, model),
    },
];

export function listInferenceProviders(): RegisteredProvider[] {
    return [...REGISTRY];
}

export function createInferenceAdapter(userApiKey: string, model: string): ModelAdapter {
    const provider = resolveAiProvider(model);
    const entry = REGISTRY.find(p => p.id === provider) ?? REGISTRY[0];
    return entry.createAdapter(userApiKey, model);
}

export function defaultInferenceProviderId(): AiProviderId {
    const forced = (process.env.AI_PROVIDER ?? 'openrouter').trim().toLowerCase();
    if (forced === 'gemini' || forced === 'google') return 'gemini';
    return 'openrouter';
}
