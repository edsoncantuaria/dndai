import type { Content } from '@google/genai';

export type GeminiMessage = Content;

export type ModelAdapter = {
    provider: 'gemini' | 'openrouter';
    modelName: string;
    isGemma: boolean;
    supportsStructuredOutput: boolean;
    generateContent: (
        body: Record<string, unknown>,
        systemInstructionPayload?: GeminiMessage,
    ) => Promise<unknown>;
    countTokens: (
        body: Record<string, unknown>,
        systemInstructionPayload?: GeminiMessage,
    ) => Promise<{ totalTokens?: number; tokenCount?: number } | undefined>;
};
