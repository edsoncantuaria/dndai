import { extractResponseText } from '../../ai/responseParser.js';
import { OSS_120B_MODEL } from '../constants.js';
import { createOssModelAdapter } from './openRouterClient.js';

export type OssPlainTextParams = {
    apiKey: string;
    userPrompt: string;
    systemPrompt?: string;
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
};

/** Geração de texto livre (resumos, recaps) via OSS-120B. */
export async function generateOssPlainText(params: OssPlainTextParams): Promise<string | null> {
    const model = params.model?.trim() || process.env.AI_DEFAULT_MODEL?.trim() || OSS_120B_MODEL;
    const adapter = createOssModelAdapter(params.apiKey, model);

    try {
        const raw = await adapter.generateContent(
            {
                contents: [{ role: 'user', parts: [{ text: params.userPrompt }] }],
                config: {
                    temperature: params.temperature ?? 0.45,
                    maxOutputTokens: params.maxOutputTokens ?? 512,
                },
            },
            params.systemPrompt
                ? { role: 'system', parts: [{ text: params.systemPrompt }] }
                : undefined,
        );
        const text = extractResponseText(raw)?.trim();
        return text ? text.replace(/\n{3,}/g, '\n\n').trim() : null;
    } catch (error) {
        console.error('[ossPlainText] Falha:', error);
        return null;
    }
}
