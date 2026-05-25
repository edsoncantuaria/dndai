import type { GeminiMessage } from '../../ai/providers/types.js';
import { getOpenRouterManager } from './OpenRouterManager.js';
import { normalizeOpenRouterModelId } from '../../ai/providers/openRouterAdapter.js';

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

type StreamResult = {
    content: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    finishReason?: string;
};

function systemTextFromPayload(payload?: GeminiMessage): string {
    const parts = payload?.parts;
    if (!Array.isArray(parts)) return '';
    return parts
        .map(p => (typeof (p as { text?: string }).text === 'string' ? (p as { text: string }).text : ''))
        .join('');
}

function extractUserText(body: Record<string, unknown>): string {
    const contents = body.contents as Array<{ parts?: Array<{ text?: string }> }> | undefined;
    if (!Array.isArray(contents)) return '';
    return contents
        .map(entry => {
            const parts = entry?.parts;
            if (!Array.isArray(parts)) return '';
            return parts.map(p => (typeof p?.text === 'string' ? p.text : '')).join('');
        })
        .filter(Boolean)
        .join('\n\n');
}

function isRateLimitError(err: unknown): boolean {
    const e = err as Error & { status?: number };
    return e.status === 429 || /rate limit|rate-limited/i.test(e.message ?? '');
}

function consumeSseBuffer(
    buffer: string,
    onDelta: (text: string) => void,
): { remainder: string; usage?: StreamResult['usage']; finishReason?: string } {
    let usage: StreamResult['usage'];
    let finishReason: string | undefined;
    const parts = buffer.split('\n');
    const remainder = parts.pop() ?? '';

    for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
            const data = JSON.parse(payload) as {
                choices?: Array<{
                    delta?: { content?: string };
                    finish_reason?: string;
                }>;
                usage?: StreamResult['usage'];
            };
            const delta = data.choices?.[0]?.delta?.content ?? '';
            if (delta) onDelta(delta);
            if (data.usage) usage = data.usage;
            if (data.choices?.[0]?.finish_reason) {
                finishReason = data.choices[0].finish_reason;
            }
        } catch {
            /* ignore partial SSE */
        }
    }

    return { remainder, usage, finishReason };
}

export async function streamOpenRouterChat(params: {
    userApiKey: string;
    model: string;
    body: Record<string, unknown>;
    systemInstructionPayload?: GeminiMessage;
    onDelta: (text: string) => void;
}): Promise<StreamResult> {
    const manager = getOpenRouterManager();
    const modelId = normalizeOpenRouterModelId(params.model);
    let apiKey = manager.resolveApiKey(params.userApiKey);
    const tried = new Set<string>();
    let fullContent = '';
    let lastUsage: StreamResult['usage'];
    let finishReason: string | undefined;

    const config = (params.body.config ?? {}) as Record<string, unknown>;
    const systemInstruction = systemTextFromPayload(params.systemInstructionPayload);
    const userText = extractUserText(params.body);

    while (true) {
        tried.add(apiKey);
        const keyId = manager.findSlotIdByApiKey(apiKey);
        const started = Date.now();

        try {
            const payload: Record<string, unknown> = {
                model: modelId,
                stream: true,
                messages: [
                    ...(systemInstruction.trim()
                        ? [{ role: 'system', content: systemInstruction }]
                        : []),
                    { role: 'user', content: userText },
                ],
                temperature: typeof config.temperature === 'number' ? config.temperature : 0.75,
                max_tokens:
                    typeof config.maxOutputTokens === 'number' ? config.maxOutputTokens : 2048,
            };

            if (config.responseMimeType === 'application/json' || config.response_format) {
                payload.response_format = { type: 'json_object' };
            }

            const headers: Record<string, string> = {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            };
            const appUrl = process.env.OPENROUTER_APP_URL?.trim();
            if (appUrl) headers['HTTP-Referer'] = appUrl;
            headers['X-Title'] = process.env.OPENROUTER_APP_NAME?.trim() || 'DnDAI';

            const response = await fetch(OPENROUTER_CHAT_URL, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errBody = (await response.json().catch(() => ({}))) as {
                    error?: { message?: string };
                };
                const err = new Error(
                    errBody?.error?.message ?? `OpenRouter HTTP ${response.status}`,
                ) as Error & { status?: number };
                err.status = response.status;
                throw err;
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('OpenRouter stream sem body');
            }

            const decoder = new TextDecoder();
            let sseBuffer = '';
            fullContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                sseBuffer += decoder.decode(value, { stream: true });
                const parsed = consumeSseBuffer(sseBuffer, delta => {
                    fullContent += delta;
                    params.onDelta(delta);
                });
                sseBuffer = parsed.remainder;
                if (parsed.usage) lastUsage = parsed.usage;
                if (parsed.finishReason) finishReason = parsed.finishReason;
            }

            if (sseBuffer.trim()) {
                const tail = consumeSseBuffer(`${sseBuffer}\n`, delta => {
                    fullContent += delta;
                    params.onDelta(delta);
                });
                if (tail.usage) lastUsage = tail.usage;
                if (tail.finishReason) finishReason = tail.finishReason;
            }

            const latencyMs = Date.now() - started;
            if (keyId) {
                manager.recordSuccess(keyId, latencyMs, {
                    promptTokens: lastUsage?.prompt_tokens,
                    completionTokens: lastUsage?.completion_tokens,
                    promptChars: systemInstruction.length + userText.length,
                    completionChars: fullContent.length,
                });
            }

            return {
                content: fullContent,
                usage: lastUsage,
                finishReason,
            };
        } catch (err) {
            const latencyMs = Date.now() - started;
            if (keyId) {
                manager.recordFailure(keyId, {
                    rateLimit: isRateLimitError(err),
                    latencyMs,
                    promptChars: systemInstruction.length + userText.length,
                });
            }
            if (!isRateLimitError(err) || manager.size <= 1) {
                throw err;
            }
            const alternate = manager.pickAlternateKey(keyId ?? '');
            if (tried.has(alternate)) throw err;
            apiKey = alternate;
        }
    }
}
