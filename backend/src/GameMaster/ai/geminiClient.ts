import { GoogleGenAI } from '@google/genai';
import { penaiEnv } from '../../config/penaiEnv.js';
import { PT_BR_SYSTEM_PREFIX } from '../locale/defaultLocale.js';
import { z } from 'zod';

const NarrationSchema = z.object({
    narration: z.string().min(1),
    tone: z.enum(['dark', 'tense', 'hopeful', 'neutral', 'epic']).optional(),
    beat: z.string().optional(),
});

export type GeminiNarrationResult = z.infer<typeof NarrationSchema>;

function resolveApiKey(userKey?: string): string {
    const k = (userKey ?? penaiEnv.GEMINI_API_KEY).trim();
    if (!k) throw new Error('Chave Gemini ausente.');
    return k;
}

export async function renderNarrationPtBr(opts: {
    contextPack: Record<string, unknown>;
    userApiKey?: string;
    model?: string;
}): Promise<GeminiNarrationResult> {
    const client = new GoogleGenAI({ apiKey: resolveApiKey(opts.userApiKey) });
    const model = opts.model ?? 'gemini-2.5-flash';

    const userPrompt = JSON.stringify(opts.contextPack, null, 2);
    const response = await client.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        config: {
            systemInstruction: PT_BR_SYSTEM_PREFIX,
            responseMimeType: 'application/json',
            temperature: 0.85,
            maxOutputTokens: 2048,
        },
    });

    const raw = response.text ?? '{}';
    const parsed = JSON.parse(raw) as unknown;
    return NarrationSchema.parse(parsed);
}
