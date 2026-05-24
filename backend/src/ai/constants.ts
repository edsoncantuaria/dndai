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
    defaultFailoverChain: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'],
} as const;

export const RETRY_PROMPT_HINTS = [
    '',
    '\n\nSua resposta anterior não era JSON válido. Corrija o formato e retorne APENAS um objeto JSON completo, sem markdown.',
    '\n\nATENÇÃO FINAL: Reescreva o JSON COMPLETO, feche todas as chaves e inclua os campos obrigatórios da fase atual.',
] as const;

export type AiPipelineMode = 'full' | 'dual' | 'narration_only';

export function resolvePipelineMode(raw?: string): AiPipelineMode {
    const value = (raw ?? process.env.AI_PIPELINE_MODE ?? 'narration_only').trim().toLowerCase();
    if (value === 'full' || value === 'narration_only' || value === 'narration-only') {
        return value === 'narration-only' ? 'narration_only' : (value as AiPipelineMode);
    }
    return 'dual';
}
