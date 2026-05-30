import { stripCodeFences } from '../../services/aiRepairUtils.js';

export type LlmFieldCoerce = 'boolean' | 'string' | 'number' | 'array' | 'object';

/** Um campo canônico (inglês no código) + sinônimos EN/PT que o modelo pode devolver. */
export type LlmFieldDictionaryEntry = {
    canonical: string;
    aliasesEn?: string[];
    aliasesPt?: string[];
    /** Legado: trata todos como EN se aliasesEn/Pt omitidos. */
    aliases?: string[];
    coerce?: LlmFieldCoerce;
};

export type LlmJsonDictionary = {
    fields: LlmFieldDictionaryEntry[];
    /** Objetos embrulhados (`result`, `data`, …) são achatados antes do mapa. */
    nestKeys?: string[];
};

const DEFAULT_NEST_KEYS = ['result', 'julgamento', 'judgment', 'data', 'output', 'response'];

const BOOLEAN_TRUE = new Set([
    'true',
    '1',
    'yes',
    'sim',
    'aceito',
    'aceitavel',
    'aceitável',
    'ok',
    'allowed',
    'approved',
    'accepted',
]);

const BOOLEAN_FALSE = new Set([
    'false',
    '0',
    'no',
    'nao',
    'não',
    'rejeitado',
    'rejeitada',
    'invalido',
    'inválido',
    'denied',
    'rejected',
]);

/** Chave normalizada para lookup (minúsculas, sem acento). */
export function normalizeLlmKey(key: string): string {
    return key
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

type AliasMapEntry = { canonical: string; viaEnglish: boolean };

/** Mapa alias normalizado → campo canônico + origem EN. */
export function buildLlmAliasMap(dictionary: LlmJsonDictionary): Map<string, AliasMapEntry> {
    const map = new Map<string, AliasMapEntry>();
    for (const field of dictionary.fields) {
        const put = (alias: string, viaEnglish: boolean) => {
            map.set(normalizeLlmKey(alias), { canonical: field.canonical, viaEnglish });
        };
        put(field.canonical, true);
        for (const alias of field.aliasesEn ?? []) put(alias, true);
        for (const alias of field.aliasesPt ?? []) put(alias, false);
        for (const alias of field.aliases ?? []) put(alias, true);
    }
    return map;
}

/** Sinônimos em inglês registrados no dicionário (para inspeção / testes). */
export function listEnglishAliases(dictionary: LlmJsonDictionary): string[] {
    const english = new Set<string>();
    for (const field of dictionary.fields) {
        english.add(field.canonical);
        for (const alias of field.aliasesEn ?? field.aliases ?? []) english.add(alias);
    }
    return [...english].sort();
}

function coerceBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value !== 0;
    if (typeof value !== 'string') return undefined;
    const s = value.trim().toLowerCase();
    if (BOOLEAN_TRUE.has(s)) return true;
    if (BOOLEAN_FALSE.has(s)) return false;
    return undefined;
}

function coerceString(value: unknown): string | undefined {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return undefined;
}

function coerceNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const n = Number(value);
        if (Number.isFinite(n)) return n;
    }
    return undefined;
}

export function coerceLlmValue(value: unknown, coerce?: LlmFieldCoerce): unknown {
    if (!coerce) return value;
    if (coerce === 'boolean') return coerceBoolean(value);
    if (coerce === 'string') return coerceString(value);
    if (coerce === 'number') return coerceNumber(value);
    if (coerce === 'array' && Array.isArray(value)) return value;
    if (coerce === 'object' && isPlainObject(value)) return value;
    return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Achata raiz + primeiro nível de `nestKeys` (valores da raiz têm prioridade). */
export function flattenLlmObject(
    value: unknown,
    nestKeys: string[] = DEFAULT_NEST_KEYS,
): Record<string, unknown> {
    if (!isPlainObject(value)) return {};

    const flat: Record<string, unknown> = { ...value };
    const normalizedNest = new Set(nestKeys.map(normalizeLlmKey));

    for (const [key, nested] of Object.entries(value)) {
        if (!normalizedNest.has(normalizeLlmKey(key)) || !isPlainObject(nested)) continue;
        for (const [innerKey, innerVal] of Object.entries(nested)) {
            if (flat[innerKey] === undefined) flat[innerKey] = innerVal;
        }
    }

    return flat;
}

export type LlmTranslateMatch = {
    canonical: string;
    sourceKey: string;
    viaEnglishAlias: boolean;
};

/**
 * Traduz payload JSON do LLM para chaves canônicas (inglês).
 * Sempre deve rodar antes do Zod — cobre aliases EN/PT e objetos aninhados.
 */
export function translateLlmPayload(
    value: unknown,
    dictionary: LlmJsonDictionary,
): { data: Record<string, unknown>; matches: LlmTranslateMatch[] } {
    const flat = flattenLlmObject(value, dictionary.nestKeys ?? DEFAULT_NEST_KEYS);
    const aliasMap = buildLlmAliasMap(dictionary);

    const bucket: Record<string, unknown> = {};
    const matches: LlmTranslateMatch[] = [];

    for (const [rawKey, rawVal] of Object.entries(flat)) {
        const hit = aliasMap.get(normalizeLlmKey(rawKey));
        if (!hit || bucket[hit.canonical] !== undefined) continue;
        bucket[hit.canonical] = rawVal;
        matches.push({
            canonical: hit.canonical,
            sourceKey: rawKey,
            viaEnglishAlias: hit.viaEnglish,
        });
    }

    const data: Record<string, unknown> = {};
    for (const field of dictionary.fields) {
        if (bucket[field.canonical] === undefined) continue;
        const coerced = coerceLlmValue(bucket[field.canonical], field.coerce);
        if (coerced !== undefined) data[field.canonical] = coerced;
    }

    return { data, matches };
}

export function parseLlmJsonText(
    raw: string,
    dictionary: LlmJsonDictionary,
): { ok: true; data: Record<string, unknown>; matches: LlmTranslateMatch[] } | { ok: false } {
    const trimmed = stripCodeFences(raw.trim());
    let parsed: unknown;
    try {
        parsed = JSON.parse(trimmed);
    } catch {
        return { ok: false };
    }
    if (!isPlainObject(parsed) && !Array.isArray(parsed)) {
        return { ok: false };
    }
    const { data, matches } = translateLlmPayload(parsed, dictionary);
    return { ok: true, data, matches };
}
