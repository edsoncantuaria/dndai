import { getOpenRouterManager } from '../providers/OpenRouterManager.js';
import { OSS_120B_MODEL } from '../constants.js';
import { createOssModelAdapter } from '../providers/openRouterClient.js';
import { extractResponseText } from '../../ai/responseParser.js';
import { parseOssJsonResponse } from './jsonRecovery.js';
import { OSS_SCHEMA_REF } from '../prompts/system/format.js';
import { recordJsonRepairAttempt } from '../telemetry/requestMetrics.js';
import type { OssNarrationResponse } from '../schemas/narration.schema.js';

const JSON_ONLY_SYSTEM = `Você corrige JSON quebrado de um Mestre de RPG. Idioma: português (Brasil).
Responda APENAS com um objeto JSON válido UTF-8. Não reescreva a narrativa — preserve o texto de "narration" quando possível.
${OSS_SCHEMA_REF}
Proibido: markdown, comentários, HP, dano ou rolagens.`;

export function isOssJsonOnlyRepairEnabled(): boolean {
    return !['0', 'false', 'no', 'off'].includes(
        (process.env.OSS_JSON_ONLY_REPAIR ?? 'true').trim().toLowerCase(),
    );
}

/**
 * Mini-chamada OSS só para consertar JSON (não re-narrar o turno).
 */
export async function runOssJsonOnlyRepair(
    brokenRaw: string,
    opts: {
        apiKey: string;
        playerAction?: string;
        repairHint?: string;
    },
): Promise<{ ok: boolean; data?: OssNarrationResponse; raw?: string }> {
    if (!isOssJsonOnlyRepairEnabled()) {
        return { ok: false };
    }

    const trimmed = brokenRaw?.trim();
    if (!trimmed || trimmed.length < 8) {
        return { ok: false };
    }

    const manager = getOpenRouterManager();
    const poolKey = manager.hasKeys() ? manager.resolveApiKey(opts.apiKey) : opts.apiKey;
    const model = process.env.AI_DEFAULT_MODEL?.trim() || OSS_120B_MODEL;
    const adapter = createOssModelAdapter(poolKey, model);

    const userPrompt = [
        'JSON_QUEBRADO:',
        trimmed.slice(0, 6000),
        opts.playerAction ? `ACAO_ORIGINAL=${opts.playerAction.slice(0, 400)}` : null,
        opts.repairHint ? `ERRO=${opts.repairHint.slice(0, 500)}` : null,
        'Saída: só o objeto JSON corrigido.',
    ]
        .filter(Boolean)
        .join('\n');

    try {
        const rawResponse = await adapter.generateContent(
            {
                contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
                config: {
                    temperature: 0.05,
                    topP: 0.8,
                    maxOutputTokens: 900,
                    responseMimeType: 'application/json',
                },
            },
            { role: 'system', parts: [{ text: JSON_ONLY_SYSTEM }] },
        );

        const raw = extractResponseText(rawResponse) ?? '';
        const parsed = parseOssJsonResponse(raw);
        recordJsonRepairAttempt(parsed.ok);
        if (!parsed.ok || parsed.data === undefined) {
            return { ok: false, raw };
        }
        return { ok: true, data: parsed.data as OssNarrationResponse, raw };
    } catch (err) {
        console.warn('[jsonOnlyRepair] Falha:', err);
        recordJsonRepairAttempt(false);
        return { ok: false };
    }
}
