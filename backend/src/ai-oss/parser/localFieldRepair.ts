import type { ActionDomain } from '../actions/registry.js';
import { normalizeActionOptionsFromRegistry } from '../actions/registry.js';
import type { OssNarrationResponse } from '../schemas/narration.schema.js';

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function coerceActionOptions(
    raw: unknown,
    domain: ActionDomain,
): OssNarrationResponse['actionOptions'] {
    if (Array.isArray(raw) && raw.length > 0) {
        const cleaned = raw
            .map(item => {
                if (typeof item === 'string' && item.trim()) return item.trim();
                if (item && typeof item === 'object') {
                    const o = item as Record<string, unknown>;
                    const text = String(o.text ?? o.action ?? '').trim();
                    const action = String(o.action ?? o.text ?? text).trim();
                    if (text) return { text, action, skill: o.skill as string | undefined };
                }
                return null;
            })
            .filter(Boolean) as OssNarrationResponse['actionOptions'];
        if (cleaned.length) {
            return normalizeActionOptionsFromRegistry(cleaned, domain);
        }
    }
    return normalizeActionOptionsFromRegistry([], domain);
}

function coerceNarrationText(raw: unknown): string {
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
    return '';
}

function coerceLogEntries(raw: unknown, narration: string): OssNarrationResponse['logEntries'] {
    if (Array.isArray(raw) && raw.length > 0) {
        return raw.map(entry => {
            const e = asRecord(entry);
            if (!e) return { type: 'narration' as const, content: String(entry) };
            const type = typeof e.type === 'string' ? e.type : 'narration';
            const content =
                typeof e.content === 'string'
                    ? e.content
                    : asRecord(e.content)?.text ?? asRecord(e.content)?.content ?? narration;
            return {
                type: ['narration', 'action', 'system', 'combat', 'insight', 'roll'].includes(type)
                    ? (type as 'narration')
                    : 'narration',
                content: String(content ?? narration),
            };
        });
    }
    if (narration) {
        return [{ type: 'narration', content: narration }];
    }
    return undefined;
}

/**
 * Repara campos faltantes sem nova chamada à API (economiza cota).
 */
export function tryLocalOssFieldRepair(
    raw: unknown,
    opts: { combatActive?: boolean; playerAction?: string; domain?: ActionDomain } = {},
): OssNarrationResponse | null {
    const obj = asRecord(raw);
    if (!obj) return null;

    const narration = coerceNarrationText(obj.narration);
    const logEntries = coerceLogEntries(obj.logEntries, narration);
    const domain: ActionDomain =
        opts.domain ?? (opts.combatActive ? 'combat' : 'exploration');
    const actionOptions = coerceActionOptions(obj.actionOptions, domain);

    if (!narration && !logEntries?.length) {
        return null;
    }

    return {
        narration: narration || undefined,
        logEntries,
        actionOptions,
        systemLog:
            typeof obj.systemLog === 'string' || obj.systemLog === null
                ? (obj.systemLog as string | null)
                : null,
        state_changes: Array.isArray(obj.state_changes)
            ? obj.state_changes.map(String).slice(0, 12)
            : undefined,
    };
}
