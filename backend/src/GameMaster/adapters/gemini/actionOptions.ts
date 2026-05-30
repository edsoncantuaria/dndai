import { z } from 'zod';
import { penaiEnv } from '../../../config/penaiEnv.js';
import { parseLlmJsonText } from '../../ai/llmJsonTranslator.js';
import { ACTION_OPTIONS_LLM_DICTIONARY } from '../../ai/llmJsonSchemas.js';
import { ACTION_OPTIONS_RESPONSE_JSON_SCHEMA } from '../../ai/geminiSchemas.js';
import { generateGeminiStructuredJson } from '../../ai/geminiStructured.js';
import {
    buildActionOptionsUserPayload,
    composeActionOptionsSystemPrompt,
} from '../../ai/actionOptionsPrompt.js';
import type { NarrativeContextPack } from '../../memory/narrativePack.js';
import type { MotorActionOption } from '../../motor/actionOptionTypes.js';
import { resolveGeminiApiKey } from './apiKey.js';
import {
    penaiPipelineAiRequest,
    penaiPipelineAiResponse,
} from '../../infra/pipelineLog.js';

const VALID_SKILLS = new Set([
    'perception',
    'investigation',
    'persuasion',
    'stealth',
    'athletics',
    'insight',
    'intimidation',
    'deception',
    'acrobatics',
    'survival',
    'animal-handling',
    'arcana',
    'history',
    'medicine',
    'nature',
    'performance',
    'religion',
    'sleight-of-hand',
]);

const OptionSchema = z.object({
    text: z.string().min(4).max(96),
    action: z.string().min(2).max(48),
    skill: z.string().optional(),
    needsRoll: z.boolean(),
    dc: z.number().int().min(5).max(30).optional(),
});

const ResponseSchema = z.object({
    options: z.array(OptionSchema).min(3).max(5),
});

function normalizeOption(raw: unknown): MotorActionOption | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const row = raw as Record<string, unknown>;
    const text = String(row.text ?? row.label ?? '').trim();
    const action = String(row.action ?? row.slug ?? 'explorar').trim().toLowerCase();
    if (!text || text.length < 4) return null;
    let skill = typeof row.skill === 'string' ? row.skill.trim().toLowerCase() : undefined;
    if (skill && !VALID_SKILLS.has(skill)) skill = undefined;
    const needsRoll = Boolean(row.needsRoll ?? row.roll ?? skill);
    const dc = typeof row.dc === 'number' && Number.isFinite(row.dc) ? Math.round(row.dc) : undefined;
    return {
        text: text.slice(0, 96),
        action: action.slice(0, 48),
        ...(skill ? { skill } : {}),
        needsRoll: needsRoll && Boolean(skill),
        ...(dc ? { dc } : {}),
    };
}

export function parseActionOptionsGeminiText(raw: string): MotorActionOption[] {
    const parsed = parseLlmJsonText(raw, ACTION_OPTIONS_LLM_DICTIONARY);
    if (!parsed.ok) return [];

    let optionsRaw = parsed.data.options;
    if (!Array.isArray(optionsRaw) && Array.isArray(parsed.data)) {
        optionsRaw = parsed.data;
    }
    if (!Array.isArray(optionsRaw)) return [];

    const normalized = optionsRaw.map(normalizeOption).filter((o): o is MotorActionOption => o != null);
    const result = ResponseSchema.safeParse({ options: normalized });
    if (result.success) return result.data.options;
    return normalized.slice(0, 5);
}

export async function suggestActionOptionsGemini(opts: {
    lastNarration: string;
    pack: NarrativeContextPack;
    fallbackOptions: MotorActionOption[];
    userApiKey?: string;
    proficientSkills?: string[];
    knownSpells?: string[];
}): Promise<MotorActionOption[]> {
    const apiKey = resolveGeminiApiKey(opts.userApiKey).trim() || penaiEnv.GEMINI_API_KEY.trim();
    if (!apiKey || !opts.lastNarration.trim()) {
        return opts.fallbackOptions;
    }

    const model = 'gemini-2.5-flash';
    const systemInstruction = composeActionOptionsSystemPrompt();
    const userPayload = buildActionOptionsUserPayload({
        ...opts,
        proficientSkills: opts.proficientSkills,
        knownSpells: opts.knownSpells,
    });

    penaiPipelineAiRequest('actionOptions', {}, {
        model,
        inputSummary: 'schema=actionOptions',
        prompt: userPayload,
    });

    const t0 = performance.now();
    try {
        const raw = await generateGeminiStructuredJson({
            apiKey,
            model,
            systemInstruction,
            userPayload,
            responseJsonSchema: ACTION_OPTIONS_RESPONSE_JSON_SCHEMA as Record<string, unknown>,
            temperature: 0.55,
            maxOutputTokens: 768,
        });
        const options = parseActionOptionsGeminiText(raw);
        penaiPipelineAiResponse('actionOptions', {}, {
            ms: performance.now() - t0,
            ok: options.length >= 3,
            parsed: options.map(o => ({
                text: o.text,
                skill: o.skill,
                needsRoll: o.needsRoll,
            })),
        });
        return options.length >= 3 ? options : opts.fallbackOptions;
    } catch (e) {
        penaiPipelineAiResponse('actionOptions', {}, {
            ms: performance.now() - t0,
            ok: false,
            error: e instanceof Error ? e.message : String(e),
        });
        return opts.fallbackOptions;
    }
}
