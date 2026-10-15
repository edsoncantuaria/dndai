import { z } from 'zod';
import { penaiEnv } from '../../../config/penaiEnv.js';
import { parseGameMasterJson } from '../../ai/responseParser.js';
import { translateLlmPayload } from '../../ai/llmJsonTranslator.js';
import { WORLD_ECONOMY_BOOTSTRAP_LLM_DICTIONARY } from '../../ai/llmJsonSchemas.js';
import { WORLD_ECONOMY_BOOTSTRAP_RESPONSE_JSON_SCHEMA } from '../../ai/geminiSchemas.js';
import { generateGeminiStructuredJson } from '../../ai/geminiStructured.js';
import { resolveGeminiApiKey } from '../../adapters/gemini/apiKey.js';
import {
    penaiPipelineAiRequest,
    penaiPipelineAiResponse,
} from '../../infra/pipelineLog.js';
import type { PipelineCtx } from '../../infra/pipelineLog.js';
import { failWorldGemini } from './worldGeminiGenerationError.js';

export type EconomyItemDraft = {
    itemSlug: string;
    priceNote: string;
    scarcityDelta?: number;
};

const ItemSchema = z.object({
    itemSlug: z.enum(['wolf_pelt', 'healing_potion', 'iron_ingot', 'grain', 'ale']),
    priceNote: z.string().min(4).max(120),
    scarcityDelta: z.number().int().min(-20).max(20).optional(),
});

const ResponseSchema = z.object({
    marketSummary: z.string().min(12).max(400),
    items: z.array(ItemSchema).min(2).max(5),
});

export async function generateBootstrapEconomy(opts: {
    sessionId: number;
    userId: number;
    regionSlug: string;
    regionName: string;
    resources: Record<string, number>;
    userApiKey?: string;
    ctx?: PipelineCtx;
}): Promise<{
    marketSummary: string;
    items: EconomyItemDraft[];
    source: 'gemini';
}> {
    const ctx = opts.ctx ?? { sessionId: opts.sessionId, userId: opts.userId };
    const apiKey = resolveGeminiApiKey(opts.userApiKey);
    if (!apiKey) {
        failWorldGemini(
            'economy',
            'no_api_key',
            'Chave de inferência indisponível (BYOK ou plataforma)',
        );
    }

    const model = penaiEnv.GEMINI_GENERATION_MODEL;
    if (!model) {
        failWorldGemini('economy', 'no_model', 'GEMINI_GENERATION_MODEL ausente');
    }

    penaiPipelineAiRequest('worldBootstrap:economy', ctx, { model });
    const t0 = Date.now();

    try {
        const raw = await generateGeminiStructuredJson({
            apiKey,
            model,
            systemInstruction: [
                'Descreva a economia local de uma cidade D&D em português brasileiro.',
                'Use apenas itemSlug da lista permitida. scarcityDelta opcional (-20 a +20).',
                'Coerente com recursos regionais fornecidos — sem inventar moedas mágicas.',
            ].join('\n'),
            userPayload: {
                regionSlug: opts.regionSlug,
                regionName: opts.regionName,
                resources: opts.resources,
            },
            responseJsonSchema: WORLD_ECONOMY_BOOTSTRAP_RESPONSE_JSON_SCHEMA as Record<string, unknown>,
            temperature: 0.25,
            maxOutputTokens: 900,
        });

        const repaired = parseGameMasterJson(raw);
        if (!repaired.ok) {
            failWorldGemini('economy', 'parse_fail', repaired.error ?? 'JSON irreparável');
        }

        const { data } = translateLlmPayload(repaired.data, WORLD_ECONOMY_BOOTSTRAP_LLM_DICTIONARY);
        const zod = ResponseSchema.safeParse(data);
        if (!zod.success) {
            const detail = zod.error.issues
                .slice(0, 5)
                .map(i => `${i.path.join('.')}: ${i.message}`)
                .join('; ');
            failWorldGemini('economy', 'zod_fail', detail);
        }

        penaiPipelineAiResponse('worldBootstrap:economy', ctx, { ok: true, ms: Date.now() - t0 });
        return {
            marketSummary: zod.data.marketSummary.trim(),
            items: zod.data.items,
            source: 'gemini',
        };
    } catch (err) {
        if (err instanceof Error && err.name === 'WorldGeminiGenerationError') throw err;
        penaiPipelineAiResponse('worldBootstrap:economy', ctx, { ok: false, ms: Date.now() - t0 });
        failWorldGemini('economy', 'gemini_error', err instanceof Error ? err.message : String(err));
    }
}
