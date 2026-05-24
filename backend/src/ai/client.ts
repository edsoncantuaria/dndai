import { GoogleGenAI, type Content } from '@google/genai';
import { MODEL } from './constants.js';

export type GeminiMessage = Content;

export const buildUserContent = (text: string): GeminiMessage => ({
    role: 'user',
    parts: [{ text: (text ?? '').toString() }],
});

export const buildSystemInstructionPayload = (instruction: string): GeminiMessage => ({
    role: 'system',
    parts: [{ text: (instruction ?? '').toString() }],
});

export type ModelAdapter = {
    modelName: string;
    isGemma: boolean;
    supportsStructuredOutput: boolean;
    generateContent: (
        body: Record<string, unknown>,
        systemInstructionPayload?: GeminiMessage,
    ) => ReturnType<GoogleGenAI['models']['generateContent']>;
    countTokens: (
        body: Record<string, unknown>,
        systemInstructionPayload?: GeminiMessage,
    ) => ReturnType<GoogleGenAI['models']['countTokens']>;
};

const RESPONSE_SCHEMA_GLOBAL_ENABLED = !['0', 'false', 'no', 'off'].includes(
    (process.env.AI_DISABLE_STRUCTURED_OUTPUT ?? 'false').trim().toLowerCase(),
);

export const allowStructuredOutputForModel = (modelName: string): boolean => {
    if (!RESPONSE_SCHEMA_GLOBAL_ENABLED) return false;
    const lower = modelName.toLowerCase();
    if (!lower.includes('gemini-2.5')) return false;
    if (lower.includes('vision') || lower.includes('flash-thinking')) return false;
    return true;
};

export const toProviderModelName = (model: string) => {
    if (!model?.trim()) return model;
    const trimmed = model.trim();
    if (trimmed.startsWith('models/')) return trimmed;
    if (trimmed.includes('/')) return trimmed;
    return `models/${trimmed}`;
};

export function createGeminiClient(apiKey: string): GoogleGenAI {
    if (!apiKey) {
        throw new Error('Chave de API do Google não configurada.');
    }
    return new GoogleGenAI({ apiKey });
}

export function createModelAdapter(genAI: GoogleGenAI, targetModel: string): ModelAdapter {
    const lower = targetModel.toLowerCase();
    const gemmaMode = lower.includes('gemma');
    const supportsStructuredOutput = allowStructuredOutputForModel(targetModel);
    const providerModelName = toProviderModelName(targetModel);

    const withSystemInstruction = (body: Record<string, unknown>, systemInstructionPayload?: GeminiMessage) => {
        if (!systemInstructionPayload || gemmaMode) return body;
        return { ...body, systemInstruction: systemInstructionPayload };
    };

    return {
        modelName: targetModel,
        isGemma: gemmaMode,
        supportsStructuredOutput,
        generateContent: (body, systemInstructionPayload) =>
            genAI.models.generateContent({
                model: providerModelName,
                ...withSystemInstruction(body, systemInstructionPayload),
            }),
        countTokens: (body, systemInstructionPayload) =>
            genAI.models.countTokens({
                model: providerModelName,
                ...withSystemInstruction(body, systemInstructionPayload),
            }),
    };
}

export function resolveFailoverChain(): string[] {
    const fromEnv = (process.env.AI_FAILOVER_CHAIN ?? MODEL.defaultFailoverChain.join(','))
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    return fromEnv.length ? fromEnv : [...MODEL.defaultFailoverChain];
}

export const isFailoverEnabled = (): boolean =>
    !['1', 'true', 'yes', 'on'].includes(
        (process.env.AI_DISABLE_AUTO_FAILOVER ?? 'false').toString().trim().toLowerCase(),
    );
