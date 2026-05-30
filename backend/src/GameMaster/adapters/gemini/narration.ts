import { z } from 'zod';
import type { NarrationProvider, NarrationResult } from '../contracts.js';
import { resolveGeminiApiKey } from './apiKey.js';
import { parseLlmJsonText } from '../../ai/llmJsonTranslator.js';
import { NARRATION_MINIMAL_LLM_DICTIONARY } from '../../ai/llmJsonSchemas.js';
import { NARRATION_MINIMAL_RESPONSE_JSON_SCHEMA } from '../../ai/geminiSchemas.js';
import { generateGeminiStructuredJson } from '../../ai/geminiStructured.js';
import { composeSystemPrompt } from '../../ai/promptComposer.js';
import type { PenaiSceneMode } from '../../ai/promptComposer.js';
import {
    penaiPipelineAiRequest,
    penaiPipelineAiResponse,
} from '../../infra/pipelineLog.js';

const VALID_TONES = new Set(['dark', 'tense', 'hopeful', 'neutral', 'epic']);

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

function normalizeTone(value: unknown): GeminiNarrationResult['tone'] {
    if (typeof value !== 'string' || !value.trim()) return undefined;
    const t = value.trim().toLowerCase();
    if (VALID_TONES.has(t)) return t as GeminiNarrationResult['tone'];
    const map: Record<string, GeminiNarrationResult['tone']> = {
        escuro: 'dark',
        sombrio: 'dark',
        tenso: 'tense',
        esperanca: 'hopeful',
        esperança: 'hopeful',
        neutro: 'neutral',
        epico: 'epic',
        épico: 'epic',
    };
    return map[t];
}

export function parseGeminiNarrationText(raw: string): GeminiNarrationResult {
    const fromTranslator = parseLlmJsonText(raw, NARRATION_MINIMAL_LLM_DICTIONARY);
    if (!fromTranslator.ok) {
        throw new Error('JSON inválido do Gemini (narração).');
    }
    const data = fromTranslator.data;

    const normalized = {
        narration: typeof data.narration === 'string' ? data.narration.trim() : '',
        tone: normalizeTone(data.tone),
        beat: typeof data.beat === 'string' && data.beat.trim() ? data.beat.trim() : undefined,
    };

    const result = NarrationSchema.safeParse(normalized);
    if (result.success) return result.data;

    throw new Error(
        result.error.issues[0]?.message ?? 'Resposta de narração inválida do Gemini.',
    );
}

export async function renderNarrationPtBr(opts: {
    contextPack: Record<string, unknown>;
    userApiKey?: string;
    model?: string;
    sceneMode?: PenaiSceneMode;
}): Promise<GeminiNarrationResult> {
    return geminiNarrationProvider.render(opts.contextPack, {
        userApiKey: opts.userApiKey,
        model: opts.model,
        sceneMode: opts.sceneMode,
    });
}

export const geminiNarrationProvider: NarrationProvider = {
    async render(contextPack, opts): Promise<NarrationResult> {
        const apiKey = resolveApiKey(opts?.userApiKey);
        const model = opts?.model ?? 'gemini-2.5-flash';
        const sceneMode = opts?.sceneMode ?? 'exploration';
        const systemInstruction = composeSystemPrompt({ role: 'narrator', sceneMode });

        penaiPipelineAiRequest('narration', {}, {
            model,
            inputSummary: `scene=${sceneMode} schema=narration`,
            prompt: contextPack,
        });

        const t0 = performance.now();
        try {
            const raw = await generateGeminiStructuredJson({
                apiKey,
                model,
                systemInstruction,
                userPayload: contextPack,
                responseJsonSchema: NARRATION_MINIMAL_RESPONSE_JSON_SCHEMA as Record<string, unknown>,
                temperature: 0.85,
                maxOutputTokens: 2048,
            });

            const parsed = parseGeminiNarrationText(raw);
            penaiPipelineAiResponse('narration', {}, {
                ms: performance.now() - t0,
                raw,
                parsed: { tone: parsed.tone, narrationLen: parsed.narration.length, sceneMode },
                ok: true,
            });
            return parsed;
        } catch (e) {
            penaiPipelineAiResponse('narration', {}, {
                ms: performance.now() - t0,
                raw: '',
                ok: false,
                error: e instanceof Error ? e.message : String(e),
            });
            throw e;
        }
    },
};
