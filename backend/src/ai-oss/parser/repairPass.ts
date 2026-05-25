import { parseGameMasterJson, type ParseJsonResult } from '../../ai/responseParser.js';
import { normalizeOssJsonQuotes } from './quoteNormalizer.js';
import { recordJsonRepairAttempt } from '../telemetry/requestMetrics.js';

export type OssRepairStage =
    | 'normalize-quotes'
    | 'direct'
    | 'legacy-repair'
    | 'failed';

export type OssRepairPassResult = ParseJsonResult & {
    stages: OssRepairStage[];
};

/**
 * Pipeline de repair antes de pedir nova geração à API.
 * Ordem: normalizar aspas → parse legado (multi-estratégia).
 */
export function runOssRepairPass(rawText: string): OssRepairPassResult {
    const stages: OssRepairStage[] = [];
    const trimmed = rawText?.trim() ?? '';

    if (!trimmed) {
        recordJsonRepairAttempt(false);
        return { ok: false, rawText: trimmed, error: 'Resposta vazia', stages: ['failed'] };
    }

    const normalized = normalizeOssJsonQuotes(trimmed);
    if (normalized !== trimmed) {
        stages.push('normalize-quotes');
    }

    let result = parseGameMasterJson(normalized);
    if (result.ok) {
        stages.push('direct');
        recordJsonRepairAttempt(true);
        return { ...result, stages };
    }

    if (normalized !== trimmed) {
        result = parseGameMasterJson(trimmed);
        if (result.ok) {
            stages.push('legacy-repair');
            recordJsonRepairAttempt(true);
            return { ...result, stages: [...stages, 'legacy-repair'] };
        }
    }

    stages.push('failed');
    recordJsonRepairAttempt(false);
    return { ...result, stages };
}
