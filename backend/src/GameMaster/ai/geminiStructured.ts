import { GoogleGenAI } from '@google/genai';
import { extractResponseText } from '../../ai/responseParser.js';
import { penaiEnv } from '../../config/penaiEnv.js';

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

function isDailyQuotaExhausted(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return /PerDayPerProject|per day|GenerateRequestsPerDay/i.test(msg);
}

/** Erros que não se resolvem com nova tentativa — turno deve abortar sem narração fictícia. */
export function isNonRecoverableNarrationError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    if (/Cota diária do Gemini|Créditos de IA esgotados/i.test(msg)) return true;
    if (isDailyQuotaExhausted(err)) return true;
    return /Chave Gemini ausente|GEMINI_MODEL não configurado|API key|401|403|PERMISSION_DENIED|429|RESOURCE_EXHAUSTED|503|UNAVAILABLE/i.test(
        msg,
    );
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
        throw err;
    }
}

/** @deprecated Mantido para testes — política atual é sempre 1 tentativa. */
export function getGeminiMaxAttempts(): number {
    return penaiEnv.GEMINI_MAX_ATTEMPTS;
}
