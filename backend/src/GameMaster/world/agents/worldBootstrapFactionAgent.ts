import { z } from 'zod';
import { penaiEnv } from '../../../config/penaiEnv.js';
import { parseGameMasterJson } from '../../../ai/responseParser.js';
import { translateLlmPayload } from '../../ai/llmJsonTranslator.js';
import { WORLD_FACTION_BOOTSTRAP_LLM_DICTIONARY } from '../../ai/llmJsonSchemas.js';
import { WORLD_FACTION_BOOTSTRAP_RESPONSE_JSON_SCHEMA } from '../../ai/geminiSchemas.js';
import { generateGeminiStructuredJson } from '../../ai/geminiStructured.js';
import { resolveGeminiApiKey } from '../../adapters/gemini/apiKey.js';
import {
    penaiPipelineAiRequest,
    penaiPipelineAiResponse,
} from '../../infra/pipelineLog.js';
import type { PipelineCtx } from '../../infra/pipelineLog.js';
import { getFactionCatalogEntry } from '../factionCatalog.js';
import { failWorldGemini } from './worldGeminiGenerationError.js';

export type FactionBeatDraft = {
    factionSlug: string;
    localHeadline: string;
    rumor: string;
};

const BeatSchema = z.object({
    factionSlug: z.string().min(2),
    localHeadline: z.string().min(4).max(80),
    rumor: z.string().min(8).max(220),
});

const ResponseSchema = z.object({
    factionBeats: z.array(BeatSchema).min(1).max(6),
});

export async function generateBootstrapFactionBeats(opts: {
    sessionId: number;
    userId: number;
    regionSlug: string;
    regionName: string;
    factionSlugs: string[];
    userApiKey?: string;
    ctx?: PipelineCtx;
}): Promise<{ beats: FactionBeatDraft[]; source: 'gemini' }> {
    const ctx = opts.ctx ?? { sessionId: opts.sessionId, userId: opts.userId };
    if (!opts.factionSlugs.length) {
        return { beats: [], source: 'gemini' };
    }

    const apiKey = resolveGeminiApiKey(opts.userApiKey);
    if (!apiKey) {
        failWorldGemini(
            'faction',
            'no_api_key',
            'Chave de inferência indisponível (BYOK ou plataforma)',
        );
    }

    const model = penaiEnv.GEMINI_GENERATION_MODEL;
    if (!model) {
        failWorldGemini('faction', 'no_model', 'GEMINI_GENERATION_MODEL ausente');
    }

    const catalog = opts.factionSlugs.map(slug => {
        const e = getFactionCatalogEntry(slug);
        return { slug, displayName: e?.displayName ?? slug, description: e?.description ?? '' };
    });

    penaiPipelineAiRequest('worldBootstrap:faction', {}, { model }, ctx);
    const t0 = Date.now();

    try {
        const raw = await generateGeminiStructuredJson({
            apiKey,
            model,
            systemInstruction: [
                'Gere boatos locais para facções JÁ descobertas em uma cidade D&D.',
                'Use exatamente os factionSlug fornecidos — não crie facções novas.',
                'Português brasileiro; tom medieval-fantasia; sem mecânicas.',
            ].join('\n'),
            userPayload: {
                regionSlug: opts.regionSlug,
                regionName: opts.regionName,
                factions: catalog,
            },
            responseJsonSchema: WORLD_FACTION_BOOTSTRAP_RESPONSE_JSON_SCHEMA as Record<string, unknown>,
            temperature: 0.3,
            maxOutputTokens: 1200,
        });

        const repaired = parseGameMasterJson(raw);
        if (!repaired.ok) {
            failWorldGemini(
                'faction',
                'parse_fail',
                repaired.error ?? 'JSON irreparável',
            );
        }

        const { data } = translateLlmPayload(repaired.data, WORLD_FACTION_BOOTSTRAP_LLM_DICTIONARY);
        const zod = ResponseSchema.safeParse(data);
        if (!zod.success) {
            const detail = zod.error.issues
                .slice(0, 5)
                .map(i => `${i.path.join('.')}: ${i.message}`)
                .join('; ');
            failWorldGemini('faction', 'zod_fail', detail);
        }

        const allowed = new Set(opts.factionSlugs);
        const beats = zod.data.factionBeats.filter(b => allowed.has(b.factionSlug));
        if (!beats.length) {
            failWorldGemini('faction', 'empty_batch', 'Nenhum factionSlug válido na resposta');
        }

        penaiPipelineAiResponse('worldBootstrap:faction', {}, { ok: true, ms: Date.now() - t0 }, ctx);
        return { beats, source: 'gemini' };
    } catch (err) {
        if (err instanceof Error && err.name === 'WorldGeminiGenerationError') throw err;
        penaiPipelineAiResponse('worldBootstrap:faction', {}, { ok: false, ms: Date.now() - t0 }, ctx);
        failWorldGemini('faction', 'gemini_error', err instanceof Error ? err.message : String(err));
    }
}
