import { GoogleGenAI } from '@google/genai';
import { extractResponseText } from '../../ai/responseParser.js';

export type GeminiStructuredRequest = {
    apiKey: string;
    model: string;
    systemInstruction: string;
    /** Objeto enviado como JSON no turno do usuário. */
    userPayload: Record<string, unknown>;
    responseJsonSchema: Record<string, unknown>;
    temperature?: number;
    maxOutputTokens?: number;
};

/**
 * Chamada Gemini com contrato JSON explícito (`responseJsonSchema`).
 * O modelo só pode devolver JSON que respeita o schema.
 */
function isDailyQuotaExhausted(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return /PerDayPerProject|per day|GenerateRequestsPerDay/i.test(msg);
}

/** Erros que não se resolvem com retry curto — turno deve abortar sem narração fictícia. */
export function isNonRecoverableNarrationError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Cota diária do Gemini|Créditos de IA esgotados/i.test(msg)) return true;
    if (isDailyQuotaExhausted(err)) return true;
    return /Chave Gemini ausente|GEMINI_MODEL não configurado|API key|401|403|PERMISSION_DENIED/i.test(
        msg,
    );
}

function parseRetryDelayMs(err: unknown): number | null {
    const msg = err instanceof Error ? err.message : String(err);
    if (/503|UNAVAILABLE|high demand/i.test(msg)) return 8000;
    if (!/429|RESOURCE_EXHAUSTED|quota/i.test(msg)) return null;
    if (isDailyQuotaExhausted(err)) return null;
    const secMatch = msg.match(/retry in ([\d.]+)s/i);
    if (secMatch) return Math.ceil(Number(secMatch[1]) * 1000) + 500;
    const delayMatch = msg.match(/"retryDelay"\s*:\s*"(\d+)s"/i);
    if (delayMatch) return Number(delayMatch[1]) * 1000 + 500;
    return 7000;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateGeminiStructuredJson(req: GeminiStructuredRequest): Promise<string> {
    const model = req.model?.trim();
    if (!model) {
        throw new Error('GEMINI_MODEL não configurado (defina GEMINI_MODEL ou AI_DEFAULT_MODEL no .env)');
    }
    if (!req.responseJsonSchema || typeof req.responseJsonSchema !== 'object') {
        throw new Error('responseJsonSchema inválido');
    }
    const client = new GoogleGenAI({ apiKey: req.apiKey });
    const maxAttempts = 12;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const response = await client.models.generateContent({
                model,
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: JSON.stringify(req.userPayload, null, 2) }],
                    },
                ],
                config: {
                    systemInstruction: req.systemInstruction,
                    responseMimeType: 'application/json',
                    responseJsonSchema: req.responseJsonSchema,
                    temperature: req.temperature ?? 0.2,
                    maxOutputTokens: req.maxOutputTokens ?? 2048,
                },
            });
            const text = extractResponseText(response);
            if (!text.trim()) {
                throw new Error('Resposta Gemini structured vazia (sem candidates/text)');
            }
            return text;
        } catch (err) {
            if (isDailyQuotaExhausted(err)) {
                throw new Error(
                    'Cota diária do Gemini esgotada (free tier ~20 req/dia por modelo). Aguarde reset ou use outra chave/modelo.',
                    { cause: err },
                );
            }
            const delay = parseRetryDelayMs(err);
            if (delay == null || attempt >= maxAttempts) throw err;
            console.warn(
                `[Gemini] 429/quota — tentativa ${attempt}/${maxAttempts}, aguardando ${Math.round(delay / 1000)}s…`,
            );
            await sleep(delay);
        }
    }

    throw new Error('Gemini structured: tentativas esgotadas');
}
