/** Limites de tokens por bloco de prompt (Fase 3.3). */
export const PROMPT_BUDGET = {
    state: 500,
    action: 300,
    memory: 400,
    map: 200,
    rules: 300,
    totalSoftCap: 9500,
} as const;

export const JSON_PARSE = {
    maxRepairAttempts: 4,
    incompleteFlag: '[INCOMPLETE_END_FLAG]',
} as const;

export const MODEL = {
    minOutputTokens: 1024,
    defaultOutputTokens: 8192,
    hardOutputCap: 8192,
    maxAttempts: 3,
    /** Padrão: OpenRouter free → Gemini fallback (ver providerFactory). */
    defaultFailoverChain: [
        'meta-llama/llama-3.3-70b-instruct:free',
        'qwen/qwen3-next-80b-a3b-instruct:free',
        'openai/gpt-oss-120b:free',
        'nousresearch/hermes-3-llama-3.1-405b:free',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
    ],
    defaultGameplayModel: 'meta-llama/llama-3.3-70b-instruct:free',
} as const;

export const RETRY_PROMPT_HINTS = [
    '',
    '\n\nSua resposta anterior não era JSON válido. Corrija o formato e retorne APENAS um objeto JSON completo, sem markdown.',
    '\n\nATENÇÃO FINAL: Reescreva o JSON COMPLETO, feche todas as chaves e inclua os campos obrigatórios da fase atual.',
] as const;

/** Único modo suportado: IA só narra; motor autoritativo para estado. */
export type AiPipelineMode = 'narration_only';

export function resolvePipelineMode(_raw?: string): AiPipelineMode {
    const value = (_raw ?? process.env.AI_PIPELINE_MODE ?? 'narration_only').trim().toLowerCase();
    if (value !== 'narration_only' && value !== 'narration-only') {
        console.warn(
            `[pipeline] AI_PIPELINE_MODE="${value}" ignorado; usando narration_only (modos full/dual removidos).`,
        );
    }
    return 'narration_only';
}
