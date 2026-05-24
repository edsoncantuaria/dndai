import type { GeminiMessage, ModelAdapter } from './types.js';

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

/** Resposta no formato Gemini para reutilizar extractResponseText. */
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

export function createOpenRouterAdapter(apiKey: string, targetModel: string): ModelAdapter {
    const modelId = normalizeOpenRouterModelId(targetModel);

    const callChat = async (
        body: Record<string, unknown>,
        systemInstructionPayload?: GeminiMessage,
    ): Promise<OpenRouterChatResponse> => {
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
            temperature: typeof config.temperature === 'number' ? config.temperature : 0.85,
            top_p: typeof config.topP === 'number' ? config.topP : undefined,
            max_tokens:
                typeof config.maxOutputTokens === 'number'
                    ? config.maxOutputTokens
                    : typeof config.max_tokens === 'number'
                      ? config.max_tokens
                      : 4096,
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
    };

    return {
        provider: 'openrouter',
        modelName: modelId,
        isGemma: false,
        supportsStructuredOutput: false,
        generateContent: async (body, systemInstructionPayload) => {
            const data = await callChat(body, systemInstructionPayload);
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
