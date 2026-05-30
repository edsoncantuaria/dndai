import { z } from 'zod';
import { penaiEnv } from '../../../config/penaiEnv.js';
import { parseLlmJsonText } from '../../ai/llmJsonTranslator.js';
import { SUMMARIZER_LLM_DICTIONARY } from '../../ai/llmJsonSchemas.js';
import { SUMMARIZER_RESPONSE_JSON_SCHEMA } from '../../ai/geminiSchemas.js';
import { generateGeminiStructuredJson } from '../../ai/geminiStructured.js';
import {
    buildSummarizerUserPayload,
    clipText,
    composeSystemPrompt,
    PROMPT_BUDGET,
} from '../../ai/promptComposer.js';
import { penaiPipelineLog } from '../../infra/pipelineLog.js';

const SummarizerSchema = z.object({
    summary: z.string().min(1),
});

const MAX_SUMMARY_OUT = 2000;

function fallbackConcat(memories: string[]): string {
    return memories
        .map(m => m.trim())
        .filter(Boolean)
        .join(' ')
        .slice(0, 1200);
}

export function parseSummarizerGeminiText(raw: string): { summary: string } {
    const parsed = parseLlmJsonText(raw, SUMMARIZER_LLM_DICTIONARY);
    if (!parsed.ok) {
        throw new Error('JSON inválido do Gemini (resumo).');
    }
    const summary =
        typeof parsed.data.summary === 'string' ? parsed.data.summary.trim() : '';
    const result = SummarizerSchema.safeParse({ summary });
    if (result.success) {
        return { summary: clipText(result.data.summary, MAX_SUMMARY_OUT) };
    }
    throw new Error('Resumo inválido do Gemini.');
}

/**
 * Compacta fatos de sessão em um parágrafo via Gemini (papel summarizer).
 * Sem chave ou falha → concatenação local (legado).
 */
export async function summarizeSessionMemories(opts: {
    sessionId: number;
    fromActionSequence: number;
    toActionSequence: number;
    memories: string[];
}): Promise<{ summary: string; source: 'gemini' | 'local' }> {
    const texts = opts.memories.map(m => m.trim()).filter(Boolean);
    if (!texts.length) {
        return { summary: '', source: 'local' };
    }

    const apiKey = penaiEnv.GEMINI_API_KEY.trim();
    if (!apiKey) {
        return { summary: fallbackConcat(texts), source: 'local' };
    }

    const ctx = { sessionId: opts.sessionId };
    const userPayload = buildSummarizerUserPayload({
        sessionId: opts.sessionId,
        fromSeq: opts.fromActionSequence,
        toSeq: opts.toActionSequence,
        memories: texts,
    });

    try {
        penaiPipelineLog('SUMMARIZER', 'Gemini compactação memória', {
            fatos: texts.length,
            turnos: `${opts.fromActionSequence}-${opts.toActionSequence}`,
        }, ctx);

        const raw = await generateGeminiStructuredJson({
            apiKey,
            model: 'gemini-2.5-flash',
            systemInstruction: composeSystemPrompt({ role: 'summarizer' }),
            userPayload,
            responseJsonSchema: SUMMARIZER_RESPONSE_JSON_SCHEMA as Record<string, unknown>,
            temperature: 0.25,
            maxOutputTokens: 640,
        });

        const { summary } = parseSummarizerGeminiText(raw);
        penaiPipelineLog('SUMMARIZER', 'resumo ok', { chars: summary.length }, ctx);
        return { summary, source: 'gemini' };
    } catch (e) {
        console.warn('[PENAI][summarizer] Gemini falhou, fallback local:', e);
        penaiPipelineLog(
            'SUMMARIZER',
            'fallback local',
            { error: e instanceof Error ? e.message : String(e) },
            ctx,
        );
        return { summary: fallbackConcat(texts), source: 'local' };
    }
}
