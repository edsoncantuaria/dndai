import { z } from 'zod';
import { penaiEnv } from '../../../config/penaiEnv.js';
import { parseGameMasterJson } from '../../ai/responseParser.js';
import { translateLlmPayload } from '../../ai/llmJsonTranslator.js';
import { WORLD_PULSE_NARRATOR_LLM_DICTIONARY } from '../../ai/llmJsonSchemas.js';
import { WORLD_PULSE_NARRATOR_RESPONSE_JSON_SCHEMA } from '../../ai/geminiSchemas.js';
import { generateGeminiStructuredJson } from '../../ai/geminiStructured.js';
import { resolveGeminiApiKey } from '../../adapters/gemini/apiKey.js';
import {
    penaiPipelineAiRequest,
    penaiPipelineAiResponse,
    penaiPipelineLog,
} from '../../infra/pipelineLog.js';
import type { PipelineCtx } from '../../infra/pipelineLog.js';
import type { PulsePresentation } from '../pulseCopy.js';
import { failWorldGemini } from './worldGeminiGenerationError.js';

export type PulseNarratorInput = {
    sessionId: number;
    userId: number;
    regionSlug: string | null;
    regionName: string;
    regionMood?: { fear: number; prosperity: number; crime: number } | null;
    simulationLines: string[];
    rumorTitles: string[];
    rumorBodies: string[];
    factions: Array<{ slug: string; displayName: string }>;
    activeQuests: Array<{
        title: string;
        regionSlug: string;
        regionName: string;
        synopsis: string;
        kind: string;
    }>;
    recentMemoryLines: string[];
    userApiKey?: string;
    ctx?: PipelineCtx;
};

export type PulseNarratorResult = {
    presentation: PulsePresentation;
    memoryFacts: string[];
    source: 'gemini';
};

const MoodSchema = z.enum(['ominous', 'busy', 'calm', 'festive', 'grim']);
const ResponseSchema = z.object({
    headline: z.string().min(8).max(200),
    beats: z.array(z.string().min(4).max(220)).min(2).max(4),
    mood: MoodSchema,
    memoryFacts: z.array(z.string().min(8).max(280)).min(1).max(3),
});

export async function narrateWorldPulse(input: PulseNarratorInput): Promise<PulseNarratorResult> {
    const ctx = input.ctx ?? { sessionId: input.sessionId, userId: input.userId };

    const apiKey = resolveGeminiApiKey(input.userApiKey);
    if (!apiKey) {
        failWorldGemini(
            'pulse',
            'no_api_key',
            'Chave de inferência indisponível (BYOK ou plataforma)',
        );
    }

    const model = penaiEnv.GEMINI_MODEL;
    if (!model) {
        failWorldGemini('pulse', 'no_model', 'GEMINI_MODEL ausente');
    }

    penaiPipelineAiRequest('worldPulse:narrator', ctx, { model });
    const t0 = Date.now();

    try {
        const raw = await generateGeminiStructuredJson({
            apiKey,
            model,
            systemInstruction: [
                'Você é o Mestre descrevendo o mundo entre cenas — português brasileiro, tom D&D.',
                'Use só facções, regiões e missões fornecidas. Não invente reinos novos.',
                'headline = 1 frase forte; beats = 2–4 frases curtas; memoryFacts = fatos objetivos para lembrar depois.',
            ].join('\n'),
            userPayload: {
                regionSlug: input.regionSlug,
                regionName: input.regionName,
                mood: input.regionMood,
                simulation: input.simulationLines.slice(0, 12),
                rumors: input.rumorBodies.slice(0, 4),
                factions: input.factions.slice(0, 6),
                quests: input.activeQuests.slice(0, 4),
                recentMemory: input.recentMemoryLines.slice(0, 5),
            },
            responseJsonSchema: WORLD_PULSE_NARRATOR_RESPONSE_JSON_SCHEMA as Record<string, unknown>,
            temperature: 0.35,
            maxOutputTokens: 800,
        });

        const repaired = parseGameMasterJson(raw);
        if (!repaired.ok) {
            failWorldGemini('pulse', 'parse_fail', repaired.error ?? 'JSON irreparável');
        }

        const { data } = translateLlmPayload(repaired.data, WORLD_PULSE_NARRATOR_LLM_DICTIONARY);
        const zod = ResponseSchema.safeParse(data);
        if (!zod.success) {
            const detail = zod.error.issues
                .slice(0, 5)
                .map(i => `${i.path.join('.')}: ${i.message}`)
                .join('; ');
            failWorldGemini('pulse', 'zod_fail', detail);
        }

        const beats = zod.data.beats.map(b => (b.endsWith('.') ? b : `${b}.`));
        const presentation: PulsePresentation = {
            headline: zod.data.headline.trim(),
            beats,
            mood: zod.data.mood,
        };

        penaiPipelineAiResponse('worldPulse:narrator', ctx, { ok: true, ms: Date.now() - t0 });
        return {
            presentation,
            memoryFacts: zod.data.memoryFacts.map(f => f.trim()),
            source: 'gemini',
        };
    } catch (err) {
        if (err instanceof Error && err.name === 'WorldGeminiGenerationError') throw err;
        penaiPipelineLog(
            'WORLD_AGENT:pulse',
            'falhou',
            { error: err instanceof Error ? err.message : String(err) },
            ctx,
        );
        penaiPipelineAiResponse('worldPulse:narrator', ctx, { ok: false, ms: Date.now() - t0 });
        failWorldGemini('pulse', 'gemini_error', err instanceof Error ? err.message : String(err));
    }
}
