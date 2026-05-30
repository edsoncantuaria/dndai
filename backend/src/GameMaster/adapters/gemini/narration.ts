import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { PT_BR_SYSTEM_PREFIX } from '../../locale/defaultLocale.js';
import { z } from 'zod';
import type { NarrationProvider, NarrationResult } from '../contracts.js';
import { resolveGeminiApiKey } from './apiKey.js';

const NarrationSchema = z.object({
    narration: z.string().min(1),
    tone: z.enum(['dark', 'tense', 'hopeful', 'neutral', 'epic']).optional(),
    beat: z.string().optional(),
});

export type GeminiNarrationResult = z.infer<typeof NarrationSchema>;

function resolveApiKey(userKey?: string): string {
    const k = resolveGeminiApiKey(userKey).trim();
    if (!k) throw new Error('Chave Gemini ausente.');
    return k;
}

export async function renderNarrationPtBr(opts: {
    contextPack: Record<string, unknown>;
    userApiKey?: string;
    model?: string;
}): Promise<GeminiNarrationResult> {
    return geminiNarrationProvider.render(opts.contextPack, {
        userApiKey: opts.userApiKey,
        model: opts.model,
    });
}

export const geminiNarrationProvider: NarrationProvider = {
    async render(contextPack, opts): Promise<NarrationResult> {
        const client = new GoogleGenAI({ apiKey: resolveApiKey(opts?.userApiKey) });
        const model = opts?.model ?? 'gemini-2.5-flash';

        const response = await client.models.generateContent({
            model,
            contents: [{ role: 'user', parts: [{ text: JSON.stringify(contextPack, null, 2) }] }],
            config: {
                systemInstruction: PT_BR_SYSTEM_PREFIX,
                responseMimeType: 'application/json',
                temperature: 0.85,
                maxOutputTokens: 2048,
            },
        });

        const raw = response.text ?? '{}';
        return NarrationSchema.parse(JSON.parse(raw));
    },
};
