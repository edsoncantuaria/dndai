import type { ActionDomain } from '../actions/registry.js';
import { normalizeActionOptionsFromRegistry } from '../actions/registry.js';
import type { OssNarrationResponse } from '../schemas/narration.schema.js';

const ALLOWED_ROOT_KEYS = new Set([
    'narration',
    'logEntries',
    'actionOptions',
    'systemLog',
    'state_changes',
    'newFacts',
]);

const OPTION_TEXT_KEYS = [
    'text',
    'texto',
    'label',
    'descricao',
    'descrição',
    'opcao',
    'opção',
    'option',
    'name',
    'titulo',
    'título',
    'title',
];
const OPTION_ACTION_KEYS = ['action', 'acao', 'ação', 'slug', 'id'];

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function stripDiacritics(s: string): string {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Mapeia importância em PT/EN para enum do schema. */
export function normalizeImportanceValue(
    value: unknown,
): 'low' | 'medium' | 'high' | undefined {
    if (typeof value !== 'string' || !value.trim()) return undefined;
    const key = stripDiacritics(value.trim().toLowerCase());
    const map: Record<string, 'low' | 'medium' | 'high'> = {
        low: 'low',
        baixa: 'low',
        baixo: 'low',
        menor: 'low',
        medium: 'medium',
        media: 'medium',
        medio: 'medium',
        moderada: 'medium',
        moderado: 'medium',
        high: 'high',
        alta: 'high',
        alto: 'high',
        maior: 'high',
    };
    return map[key];
}

function pickOptionField(obj: Record<string, unknown>, keys: string[]): string {
    for (const k of keys) {
        const v = obj[k];
        if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return '';
}

export function coerceNarrationText(raw: unknown): string {
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
    if (Array.isArray(raw)) {
        return raw
            .map(part => {
                if (typeof part === 'string') return part.trim();
                const r = asRecord(part);
                if (r) {
                    return String(
                        r.text ?? r.content ?? r.narration ?? r.narracao ?? '',
                    ).trim();
                }
                return String(part).trim();
            })
            .filter(Boolean)
            .join('\n\n');
    }
    const r = asRecord(raw);
    if (r) {
        return String(r.text ?? r.content ?? r.narration ?? r.narracao ?? '').trim();
    }
    return '';
}

function coerceLogEntries(
    raw: unknown,
    narration: string,
): OssNarrationResponse['logEntries'] {
    if (Array.isArray(raw) && raw.length > 0) {
        return raw.map(entry => {
            const e = asRecord(entry);
            if (!e) return { type: 'narration' as const, content: String(entry) };
            const type = typeof e.type === 'string' ? e.type : 'narration';
            let content: string;
            if (typeof e.content === 'string') {
                content = e.content;
            } else {
                const nested = asRecord(e.content);
                content = String(
                    nested?.text ??
                        nested?.content ??
                        e.text ??
                        e.texto ??
                        narration,
                );
            }
            return {
                type: ['narration', 'action', 'system', 'combat', 'insight', 'roll'].includes(
                    type,
                )
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

function coerceActionOptions(
    raw: unknown,
    domain: ActionDomain,
): OssNarrationResponse['actionOptions'] {
    if (Array.isArray(raw) && raw.length > 0) {
        const cleaned = raw
            .map(item => {
                if (typeof item === 'string' && item.trim()) return item.trim();
                const o = asRecord(item);
                if (!o) return null;
                const text = pickOptionField(o, OPTION_TEXT_KEYS);
                const action = pickOptionField(o, OPTION_ACTION_KEYS) || text;
                if (text) {
                    return {
                        text,
                        action,
                        skill: typeof o.skill === 'string' ? o.skill : undefined,
                    };
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

function coerceNewFacts(raw: unknown): OssNarrationResponse['newFacts'] {
    if (!Array.isArray(raw) || raw.length === 0) return undefined;
    const facts = raw
        .map(item => {
            const o = asRecord(item);
            if (!o) return null;
            const fact = String(o.fact ?? o.fato ?? o.text ?? o.texto ?? '').trim();
            if (fact.length < 4) return null;
            const importance = normalizeImportanceValue(
                o.importance ?? o.importancia ?? o.importância,
            );
            return {
                fact: fact.slice(0, 280),
                ...(importance ? { importance } : {}),
            };
        })
        .filter((f): f is NonNullable<typeof f> => f !== null)
        .slice(0, 6);
    return facts.length ? facts : undefined;
}

function pickAllowedRootFields(obj: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of ALLOWED_ROOT_KEYS) {
        if (key in obj) out[key] = obj[key];
    }
    return out;
}

/**
 * Normaliza payload bruto do modelo (PT, chaves extras, arrays) antes do Zod.
 */
export function normalizeOssNarrationPayload(
    raw: unknown,
    opts: { combatActive?: boolean; playerAction?: string; domain?: ActionDomain } = {},
): OssNarrationResponse | null {
    const obj = asRecord(raw);
    if (!obj) return null;

    const picked = pickAllowedRootFields(obj);
    const narration = coerceNarrationText(picked.narration);
    const logEntries = coerceLogEntries(picked.logEntries, narration);
    const domain: ActionDomain =
        opts.domain ?? (opts.combatActive ? 'combat' : 'exploration');
    const actionOptions = coerceActionOptions(picked.actionOptions, domain);
    const newFacts = coerceNewFacts(picked.newFacts);

    if (!narration && !logEntries?.length) {
        return null;
    }

    return {
        narration: narration || undefined,
        logEntries,
        actionOptions,
        newFacts,
        systemLog:
            typeof picked.systemLog === 'string' || picked.systemLog === null
                ? (picked.systemLog as string | null)
                : null,
        state_changes: Array.isArray(picked.state_changes)
            ? picked.state_changes.map(String).slice(0, 12)
            : undefined,
    };
}

/**
 * Repara campos faltantes sem nova chamada à API (economiza cota).
 */
export function tryLocalOssFieldRepair(
    raw: unknown,
    opts: { combatActive?: boolean; playerAction?: string; domain?: ActionDomain } = {},
): OssNarrationResponse | null {
    return normalizeOssNarrationPayload(raw, opts);
}
