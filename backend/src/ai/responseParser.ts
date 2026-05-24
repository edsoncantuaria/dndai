import { Buffer } from 'buffer';
import JSON5 from 'json5';
import {
    attemptJsonRepair,
    buildContinuationSnippet,
    softTailRepair,
    stripCodeFences,
    stripSuffix,
    trimAfterLastClosingBracket,
} from '../services/aiRepairUtils.js';
import { JSON_PARSE } from './constants.js';

export type JsonRepairStrategy =
    | 'direct'
    | 'soft-tail'
    | 'structure-repair'
    | 'trim-after-last-bracket'
    | 'json5'
    | 'extract-object';

export interface ParseJsonResult {
    ok: boolean;
    data?: unknown;
    strategy?: JsonRepairStrategy;
    rawText: string;
    error?: string;
}

export const extractResponseText = (response: unknown): string => {
    if (!response) return '';

    const resp = response as Record<string, unknown>;

    try {
        const primary = typeof resp.text === 'function' ? (resp.text as () => string)() : resp.text;
        if (typeof primary === 'string' && primary.trim()) {
            return primary.trim();
        }
    } catch (err) {
        console.warn('[ai/responseParser] Falha ao ler response.text():', err);
    }

    const collectFromParts = (parts: unknown[] | undefined): string[] => {
        if (!Array.isArray(parts) || !parts.length) return [];
        const chunks: string[] = [];
        for (const part of parts) {
            if (typeof part === 'string') {
                const trimmed = part.trim();
                if (trimmed) chunks.push(trimmed);
                continue;
            }
            if (!part || typeof part !== 'object') continue;
            const p = part as Record<string, unknown>;
            if (typeof p.text === 'string' && p.text.trim()) {
                chunks.push(p.text.trim());
                continue;
            }
            const fnCall = p.functionCall as Record<string, unknown> | undefined;
            if (fnCall) {
                const args = fnCall.args;
                if (typeof args === 'string' && args.trim()) {
                    chunks.push(args.trim());
                } else if (args && typeof args === 'object') {
                    chunks.push(JSON.stringify(args));
                }
            }
            const inlineData = p.inlineData as { data?: string } | undefined;
            if (inlineData?.data) {
                try {
                    const decoded = Buffer.from(inlineData.data, 'base64').toString('utf8').trim();
                    if (decoded) chunks.push(decoded);
                } catch {
                    /* ignore */
                }
            }
        }
        return chunks;
    };

    const candidates = resp.candidates as Array<{ content?: { parts?: unknown[] }; finishReason?: string }> | undefined;
    if (Array.isArray(candidates)) {
        const buffer: string[] = [];
        for (const candidate of candidates) {
            buffer.push(...collectFromParts(candidate?.content?.parts));
            if (candidate?.finishReason === 'STOP' && buffer.length) break;
        }
        const joined = buffer.join('').trim();
        if (joined) return joined;
    }

    const blockReason = (resp.promptFeedback as { blockReason?: string } | undefined)?.blockReason;
    if (blockReason) {
        return JSON.stringify({ error: blockReason, details: resp.promptFeedback });
    }

    if (resp.cachedContent) {
        return extractResponseText(resp.cachedContent);
    }

    return '';
};

function normalizeJsonCandidate(raw: string): string {
    let text = stripCodeFences(raw.trim());
    text = stripSuffix(text, JSON_PARSE.incompleteFlag);
    if (!text.startsWith('{') && !text.startsWith('[')) {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) text = match[0];
    }
    return text;
}

function tryParse(text: string): { ok: true; data: unknown } | { ok: false; error: string } {
    try {
        return { ok: true, data: JSON.parse(text) };
    } catch (e: any) {
        return { ok: false, error: e?.message ?? 'parse error' };
    }
}

/**
 * Pipeline de parse + repair para respostas JSON do Mestre de Jogo.
 */
export function parseGameMasterJson(rawText: string): ParseJsonResult {
    const trimmed = rawText?.trim() ?? '';
    if (!trimmed) {
        return { ok: false, rawText: trimmed, error: 'Resposta vazia' };
    }

    const normalized = normalizeJsonCandidate(trimmed);
    const direct = tryParse(normalized);
    if (direct.ok) {
        return { ok: true, data: direct.data, strategy: 'direct', rawText: trimmed };
    }

    const repairs: Array<{ strategy: JsonRepairStrategy; text: string | null }> = [
        { strategy: 'soft-tail', text: softTailRepair(trimmed) },
        { strategy: 'structure-repair', text: attemptJsonRepair(trimmed) },
        { strategy: 'trim-after-last-bracket', text: trimAfterLastClosingBracket(trimmed) },
    ];

    for (const repair of repairs) {
        if (!repair.text || repair.text === trimmed) continue;
        const candidate = normalizeJsonCandidate(repair.text);
        const parsed = tryParse(candidate);
        if (parsed.ok) {
            return { ok: true, data: parsed.data, strategy: repair.strategy, rawText: trimmed };
        }
    }

    try {
        const json5Data = JSON5.parse(normalized);
        return { ok: true, data: json5Data, strategy: 'json5', rawText: trimmed };
    } catch {
        /* continue */
    }

    const extracted = trimmed.match(/\{[\s\S]*\}/);
    if (extracted) {
        const parsed = tryParse(extracted[0]);
        if (parsed.ok) {
            return { ok: true, data: parsed.data, strategy: 'extract-object', rawText: trimmed };
        }
    }

    return {
        ok: false,
        rawText: trimmed,
        error: direct.ok ? undefined : (direct as { ok: false; error: string }).error,
    };
}

export function markIncompleteJson(rawText: string): string {
    if (!rawText?.trim()) return rawText;
    if (rawText.trim().endsWith('}')) return rawText;
    return `${rawText}${/\n$/.test(rawText) ? '' : '\n'}${JSON_PARSE.incompleteFlag}`;
}

export { buildContinuationSnippet, stripSuffix };
