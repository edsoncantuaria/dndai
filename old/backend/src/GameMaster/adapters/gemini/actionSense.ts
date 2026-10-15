import { z } from 'zod';
import { parseLlmJsonText, translateLlmPayload } from '../../ai/llmJsonTranslator.js';
import { ACTION_SENSE_LLM_DICTIONARY } from '../../ai/llmJsonSchemas.js';
import { ACTION_SENSE_RESPONSE_JSON_SCHEMA } from '../../ai/geminiSchemas.js';
import { generateGeminiStructuredJson } from '../../ai/geminiStructured.js';
import {
    buildArbiterUserPayload,
    composeSystemPrompt,
    inferSceneMode,
} from '../../ai/promptComposer.js';
import type { ActionSenseProvider, PlausibilityResult } from '../contracts.js';
import { resolveGeminiApiKey } from './apiKey.js';
import {
    penaiPipelineAiRequest,
    penaiPipelineAiResponse,
} from '../../infra/pipelineLog.js';

const ActionSenseSchema = z.object({
    acceptable: z.boolean(),
    reason: z.string().min(1),
    playerFacingHint: z.string().optional(),
});

export type ActionPlausibilityResult = z.infer<typeof ActionSenseSchema>;

const INFERENCE_KEY_HINT =
    'Configure sua chave Gemini (BYOK) em Configurações ou use créditos da plataforma.';

export function normalizeActionSensePayload(value: unknown): unknown {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { acceptable: true, reason: 'Resposta do modelo incompleta — aceito por padrão.' };
    }

    const { data } = translateLlmPayload(value, ACTION_SENSE_LLM_DICTIONARY);
    const acceptable = typeof data.acceptable === 'boolean' ? data.acceptable : true;
    const reason =
        typeof data.reason === 'string' && data.reason.trim()
            ? data.reason
            : acceptable === false
              ? 'Ação rejeitada pelo árbitro.'
              : 'Ação aceita.';

    return {
        acceptable,
        reason,
        ...(typeof data.playerFacingHint === 'string' && data.playerFacingHint.trim()
            ? { playerFacingHint: data.playerFacingHint }
            : {}),
    };
}

export function parseActionSenseGeminiText(raw: string): ActionPlausibilityResult {
    const parsed = parseLlmJsonText(raw, ACTION_SENSE_LLM_DICTIONARY);
    if (!parsed.ok) {
        return { acceptable: true, reason: 'JSON inválido do Gemini — heurística permissiva.' };
    }

    const normalized = normalizeActionSensePayload(parsed.data);
    const result = ActionSenseSchema.safeParse(normalized);
    if (result.success) return result.data;
    return { acceptable: true, reason: 'Formato parcial do Gemini — heurística permissiva.' };
}

export async function checkActionPlausibilityGemini(opts: {
    playerAction: string;
    regionSlug: string | null;
    intentType: string;
    sessionFacts?: string[];
    userApiKey?: string;
}): Promise<ActionPlausibilityResult> {
    return geminiActionSenseProvider.checkPlausibility(opts);
}

export const geminiActionSenseProvider: ActionSenseProvider = {
    async checkPlausibility(opts): Promise<PlausibilityResult> {
        const apiKey = resolveGeminiApiKey(opts.userApiKey).trim();
        if (!apiKey) {
            return {
                acceptable: false,
                reason: 'Árbitro indisponível — chave de inferência ausente.',
                playerFacingHint: INFERENCE_KEY_HINT,
            };
        }

        try {
            const model = 'gemini-2.5-flash';
            const sceneMode = inferSceneMode({
                playerAction: opts.playerAction,
                intentType: opts.intentType,
            });
            const userPayload = buildArbiterUserPayload(opts);
            const systemInstruction = composeSystemPrompt({
                role: 'arbiter',
                sceneMode: sceneMode === 'opening' ? 'default' : sceneMode,
            });

            penaiPipelineAiRequest('actionSense', {}, {
                model,
                inputSummary: `scene=${sceneMode} schema=acceptable,reason`,
                prompt: userPayload,
            });

            const t0 = performance.now();
            const raw = await generateGeminiStructuredJson({
                apiKey,
                model,
                systemInstruction,
                userPayload,
                responseJsonSchema: ACTION_SENSE_RESPONSE_JSON_SCHEMA as Record<string, unknown>,
                temperature: 0.2,
                maxOutputTokens: 256,
            });

            const parsed = parseActionSenseGeminiText(raw);
            penaiPipelineAiResponse('actionSense', {}, {
                ms: performance.now() - t0,
                raw,
                parsed,
                ok: true,
            });
            return parsed;
        } catch (e) {
            console.warn('[actionSense] Gemini falhou:', e);
            const failClosed =
                process.env.NODE_ENV === 'production' ||
                process.env.GEMINI_FAIL_CLOSED === '1';
            if (failClosed) {
                return {
                    acceptable: false,
                    reason: 'Validação indisponível — reformule a ação ou tente novamente.',
                };
            }
            return { acceptable: true, reason: 'Validação local (Gemini indisponível).' };
        }
    },
};
