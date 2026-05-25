import type { GeminiMessage, ModelAdapter } from './types.js';
import { getOpenRouterManager } from '../../ai-oss/providers/OpenRouterManager.js';

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

type OpenRouterChatResponse = {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
    error?: { message?: string; code?: number };
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

const extractUserText = (body: Record<string, unknown>): string => {
    const contents = body.contents as Array<{ role?: string; parts?: Array<{ text?: string }> }> | undefined;
    if (!Array.isArray(contents)) return '';
    return contents
        .map(entry => {
            const parts = entry?.parts;
            if (!Array.isArray(parts)) return '';
            return parts.map(p => (typeof p?.text === 'string' ? p.text : '')).join('');
        })
        .filter(Boolean)
        .join('\n\n');
};

const systemTextFromPayload = (payload?: GeminiMessage): string => {
    const parts = payload?.parts;
    if (!Array.isArray(parts)) return '';
    return parts.map(p => (typeof (p as { text?: string }).text === 'string' ? (p as { text: string }).text : '')).join('');
};

const toGeminiShapedResponse = (content: string, finishReason = 'STOP') => ({
    candidates: [
        {
            finishReason,
            content: {
                parts: [{ text: content }],
            },
        },
    ],
});

export function normalizeOpenRouterModelId(model: string): string {
    const trimmed = model.trim();
    return trimmed.replace(/^or:/i, '');
}

function isRateLimitError(err: unknown): boolean {
    const e = err as Error & { status?: number };
    return e.status === 429 || /rate limit|rate-limited/i.test(e.message ?? '');
}

async function callChatOnce(
    apiKey: string,
    modelId: string,
    body: Record<string, unknown>,
    systemInstructionPayload?: GeminiMessage,
): Promise<OpenRouterChatResponse> {
    const config = (body.config ?? {}) as Record<string, unknown>;
    const systemInstruction = systemTextFromPayload(systemInstructionPayload);
    const userText = extractUserText(body);

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
    if (systemInstruction.trim()) {
        messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: userText });

    const payload: Record<string, unknown> = {
        model: modelId,
        messages,
        temperature: typeof config.temperature === 'number' ? config.temperature : 0.75,
        top_p: typeof config.topP === 'number' ? config.topP : undefined,
        max_tokens:
            typeof config.maxOutputTokens === 'number'
                ? config.maxOutputTokens
                : typeof config.max_tokens === 'number'
                  ? config.max_tokens
                  : 2048,
    };

    if (config.responseMimeType === 'application/json' || config.response_format) {
        payload.response_format = { type: 'json_object' };
    }

    const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
    };
    const appUrl = process.env.OPENROUTER_APP_URL?.trim();
    const appName = process.env.OPENROUTER_APP_NAME?.trim() || 'DnDAI';
    if (appUrl) headers['HTTP-Referer'] = appUrl;
    headers['X-Title'] = appName;

    const response = await fetch(OPENROUTER_CHAT_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    });

    const data = (await response.json()) as OpenRouterChatResponse;
    if (!response.ok) {
        const msg = data?.error?.message ?? `OpenRouter HTTP ${response.status}`;
        const err = new Error(msg) as Error & { status?: number };
        err.status = response.status;
        throw err;
    }
    if (data?.error?.message) {
        throw new Error(data.error.message);
    }
    return data;
}

export function createOpenRouterAdapter(userApiKey: string, targetModel: string): ModelAdapter {
    const modelId = normalizeOpenRouterModelId(targetModel);
    const manager = getOpenRouterManager();

    const runWithRotation = async (
        body: Record<string, unknown>,
        systemInstructionPayload?: GeminiMessage,
    ): Promise<OpenRouterChatResponse> => {
        let apiKey = manager.resolveApiKey(userApiKey);
        const tried = new Set<string>();

        while (true) {
            tried.add(apiKey);
            const keyId = manager.findSlotIdByApiKey(apiKey);
            const started = Date.now();
            try {
                const data = await callChatOnce(apiKey, modelId, body, systemInstructionPayload);
                if (keyId) {
                    const sysLen = systemTextFromPayload(systemInstructionPayload).length;
                    const userLen = extractUserText(body).length;
                    const outLen = data.choices?.[0]?.message?.content?.length ?? 0;
                    manager.recordSuccess(keyId, Date.now() - started, {
                        promptTokens: data.usage?.prompt_tokens,
                        completionTokens: data.usage?.completion_tokens,
                        promptChars: sysLen + userLen,
                        completionChars: outLen,
                    });
                }
                return data;
            } catch (err) {
                const latencyMs = Date.now() - started;
                if (keyId) {
                    const sysLen = systemTextFromPayload(systemInstructionPayload).length;
                    const userLen = extractUserText(body).length;
                    manager.recordFailure(keyId, {
                        rateLimit: isRateLimitError(err),
                        latencyMs,
                        promptChars: sysLen + userLen,
                    });
                }
                if (!isRateLimitError(err) || manager.size <= 1) {
                    throw err;
                }
                const failedId = keyId ?? '';
                const alternate = manager.pickAlternateKey(failedId);
                if (tried.has(alternate)) {
                    throw err;
                }
                apiKey = alternate;
            }
        }
    };

    return {
        provider: 'openrouter',
        modelName: modelId,
        isGemma: false,
        supportsStructuredOutput: false,
        generateContent: async (body, systemInstructionPayload) => {
            const data = await runWithRotation(body, systemInstructionPayload);
            const content = data.choices?.[0]?.message?.content ?? '';
            const finish = data.choices?.[0]?.finish_reason === 'length' ? 'MAX_TOKENS' : 'STOP';
            return toGeminiShapedResponse(content, finish);
        },
        countTokens: async (body, systemInstructionPayload) => {
            const systemInstruction = systemTextFromPayload(systemInstructionPayload);
            const userText = extractUserText(body);
            const estimate = Math.ceil((systemInstruction.length + userText.length) / 4);
            return { totalTokens: estimate, tokenCount: estimate };
        },
    };
}
