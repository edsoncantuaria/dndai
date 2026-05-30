import {
    hasResolvableGeminiKey,
    resolveGeminiApiKey,
} from '../GameMaster/ai/apiKeyResolve.js';

export function resolveInferenceApiKeyForUser(userKey?: string | null): string | null {
    const key = resolveGeminiApiKey(userKey);
    return key || null;
}

export function hasResolvableInferenceKey(userKey?: string | null): boolean {
    return hasResolvableGeminiKey(userKey);
}

export function inferenceKeyRequiredMessage(): string {
    return 'Configure sua chave Gemini (BYOK) nas configurações ou use créditos da plataforma.';
}
