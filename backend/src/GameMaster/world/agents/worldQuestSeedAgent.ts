import { z } from 'zod';
import { penaiEnv } from '../../../config/penaiEnv.js';
import { parseGameMasterJson } from '../../../ai/responseParser.js';
import { translateLlmPayload } from '../../ai/llmJsonTranslator.js';
import { WORLD_QUEST_SEED_LLM_DICTIONARY } from '../../ai/llmJsonSchemas.js';
import { WORLD_QUEST_SEED_RESPONSE_JSON_SCHEMA } from '../../ai/geminiSchemas.js';
import { generateGeminiStructuredJson } from '../../ai/geminiStructured.js';
import { resolveGeminiApiKey } from '../../adapters/gemini/apiKey.js';
import {
    penaiPipelineAiRequest,
    penaiPipelineAiResponse,
    penaiPipelineLog,
} from '../../infra/pipelineLog.js';
import type { PipelineCtx } from '../../infra/pipelineLog.js';
import { failWorldGemini } from './worldGeminiGenerationError.js';

export type QuestSeedDraft = {
    title: string;
    synopsis: string;
    questSlug: string;
    regionSlug: string;
    kind: 'local' | 'travel';
    stageLabel: string;
    urgency?: 'low' | 'medium' | 'high';
};

const QuestItemSchema = z.object({
    title: z.string().min(4).max(120),
    synopsis: z.string().min(12).max(400),
    questSlug: z.string().min(3).max(64),
    regionSlug: z.string().min(3).max(64),
    kind: z.enum(['local', 'travel']),
    stageLabel: z.string().min(2).max(80),
    urgency: z.enum(['low', 'medium', 'high']).optional(),
});

const ResponseSchema = z.object({
    quests: z.array(QuestItemSchema).max(2),
});

function slugifyQuest(title: string): string {
    return title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48);
}

export async function generateBootstrapQuests(opts: {
    sessionId: number;
    userId: number;
    spawnRegionSlug: string;
    spawnRegionName: string;
    neighborRegions: Array<{ slug: string; displayName: string }>;
    userApiKey?: string;
    ctx?: PipelineCtx;
}): Promise<{ quests: QuestSeedDraft[]; source: 'gemini' }> {
    const ctx = opts.ctx ?? { sessionId: opts.sessionId, userId: opts.userId };
    const allowedSlugs = new Set([
        opts.spawnRegionSlug,
        ...opts.neighborRegions.map(n => n.slug),
    ]);

    const apiKey = resolveGeminiApiKey(opts.userApiKey);
    if (!apiKey) {
        failWorldGemini(
            'quest',
            'no_api_key',
            'Chave de inferência indisponível (BYOK ou plataforma)',
        );
    }

    const model = penaiEnv.GEMINI_GENERATION_MODEL;
    if (!model) {
        failWorldGemini('quest', 'no_model', 'GEMINI_GENERATION_MODEL ausente');
    }

    penaiPipelineAiRequest('worldBootstrap:quests', {}, { model }, ctx);
    const t0 = Date.now();

    try {
        const raw = await generateGeminiStructuredJson({
            apiKey,
            model,
            systemInstruction: [
                'Crie 0–2 missões iniciais para uma campanha D&D em português brasileiro.',
                'Use APENAS regionSlug da lista. kind=local na região spawn; kind=travel em outra região vizinha.',
                'Não invente facções novas; objetivos concretos e jogáveis.',
            ].join('\n'),
            userPayload: {
                spawnRegionSlug: opts.spawnRegionSlug,
                spawnRegionName: opts.spawnRegionName,
                allowedRegions: [
                    { slug: opts.spawnRegionSlug, name: opts.spawnRegionName },
                    ...opts.neighborRegions,
                ],
            },
            responseJsonSchema: WORLD_QUEST_SEED_RESPONSE_JSON_SCHEMA as Record<string, unknown>,
            temperature: 0.4,
            maxOutputTokens: 600,
        });

        const repaired = parseGameMasterJson(raw);
        if (!repaired.ok) {
            failWorldGemini('quest', 'parse_fail', repaired.error ?? 'JSON irreparável');
        }

        const { data } = translateLlmPayload(repaired.data, WORLD_QUEST_SEED_LLM_DICTIONARY);
        const zod = ResponseSchema.safeParse(data);
        if (!zod.success) {
            const detail = zod.error.issues
                .slice(0, 5)
                .map(i => `${i.path.join('.')}: ${i.message}`)
                .join('; ');
            failWorldGemini('quest', 'zod_fail', detail);
        }

        const quests: QuestSeedDraft[] = zod.data.quests
            .filter(q => allowedSlugs.has(q.regionSlug))
            .map(q => ({
                title: q.title.trim(),
                synopsis: q.synopsis.trim(),
                questSlug: q.questSlug.trim() || slugifyQuest(q.title),
                regionSlug: q.regionSlug.trim(),
                kind: q.kind,
                stageLabel: q.stageLabel.trim(),
                urgency: q.urgency,
            }));

        if (!quests.length) {
            failWorldGemini('quest', 'empty_batch', 'Gemini não devolveu missões com regionSlug válido');
        }

        penaiPipelineAiResponse('worldBootstrap:quests', {}, { ok: true, ms: Date.now() - t0 }, ctx);
        return { quests, source: 'gemini' };
    } catch (err) {
        if (err instanceof Error && err.name === 'WorldGeminiGenerationError') throw err;
        penaiPipelineLog(
            'WORLD_AGENT:quests',
            'falhou',
            { error: err instanceof Error ? err.message : String(err) },
            ctx,
        );
        penaiPipelineAiResponse('worldBootstrap:quests', {}, { ok: false, ms: Date.now() - t0 }, ctx);
        failWorldGemini('quest', 'gemini_error', err instanceof Error ? err.message : String(err));
    }
}
