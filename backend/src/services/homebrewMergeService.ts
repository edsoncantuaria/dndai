import type { HomebrewSourceKind } from '../types/homebrewSource.js';
import { SRD_TRANSLATABLE_FIELDS } from '../types/homebrewSource.js';

const norm = (value?: string | null) => (value ?? '').toLowerCase().trim();

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Mescla profunda: valores definidos em `overrides` substituem `base`.
 */
export function deepMergeSrd<T extends Record<string, unknown>>(base: T, overrides: Record<string, unknown>): T {
    const result: Record<string, unknown> = { ...base };

    for (const [key, value] of Object.entries(overrides)) {
        if (value === undefined) continue;
        const existing = result[key];
        if (isPlainObject(existing) && isPlainObject(value)) {
            result[key] = deepMergeSrd(existing as Record<string, unknown>, value);
        } else {
            result[key] = value;
        }
    }

    return result as T;
}

/**
 * Aplica apenas campos traduzíveis sobre o oficial.
 */
export function applyTranslationOverlay(
    official: Record<string, unknown>,
    translation: Record<string, unknown>,
    srdResource: string,
): Record<string, unknown> {
    const allowed = new Set(SRD_TRANSLATABLE_FIELDS[srdResource] ?? ['name', 'desc']);
    const patch: Record<string, unknown> = {};

    for (const field of allowed) {
        if (translation[field] !== undefined && translation[field] !== null) {
            patch[field] = translation[field];
        }
    }

    return {
        ...official,
        ...patch,
        index: official.index ?? translation.index,
        official_index: official.index ?? translation.official_index,
        _translationLocale: translation._locale ?? translation.locale ?? 'pt-BR',
        _source: 'translation',
    };
}

/**
 * Fork: oficial + overrides do usuário; index pode ser novo.
 */
export function applyForkOverlay(
    official: Record<string, unknown>,
    forkContent: Record<string, unknown>,
): Record<string, unknown> {
    const merged = deepMergeSrd(official, forkContent);
    const forkIndex = forkContent.index as string | undefined;
    return {
        ...merged,
        index: forkIndex || merged.index,
        official_index: official.index ?? forkContent.official_index,
        _forkedFrom: official.index,
        _source: 'fork',
    };
}

export function mergeOfficialWithHomebrew(
    official: Record<string, unknown> | null,
    homebrewContent: Record<string, unknown>,
    sourceKind: HomebrewSourceKind,
    srdResource: string,
): Record<string, unknown> {
    if (!official) {
        return {
            ...homebrewContent,
            _source: sourceKind,
        };
    }

    switch (sourceKind) {
        case 'translation':
            return applyTranslationOverlay(official, homebrewContent, srdResource);
        case 'fork':
            return applyForkOverlay(official, homebrewContent);
        case 'original':
        default:
            return {
                ...homebrewContent,
                _source: 'original',
            };
    }
}

export function resolveOfficialIndex(
    content: Record<string, unknown>,
    meta?: { sourceIndex?: string | null; sourceKind?: HomebrewSourceKind },
): string | null {
    const fromMeta = meta?.sourceIndex ? norm(meta.sourceIndex) : null;
    if (fromMeta) return fromMeta;
    const fromContent = content.official_index ?? content._forkedFrom;
    if (typeof fromContent === 'string' && fromContent.trim()) {
        return norm(fromContent);
    }
    if (meta?.sourceKind === 'original') {
        return typeof content.index === 'string' ? norm(content.index) : null;
    }
    return null;
}
