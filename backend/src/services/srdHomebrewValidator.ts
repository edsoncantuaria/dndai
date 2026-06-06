import createError from 'http-errors';
import type { PenaiHomebrewContentType as HomebrewContentType } from '../GameMaster/database/entities/HomebrewContent.js';
import type { HomebrewSourceKind, HomebrewSourceMeta } from '../types/homebrewSource.js';
import {
    HOMEBREW_TYPE_TO_SRD_RESOURCE,
    SRD_REQUIRED_INDEX_FIELDS,
    SRD_TRANSLATABLE_FIELDS,
} from '../types/homebrewSource.js';
import * as SrdApi from './srdApiAdapter.js';

const norm = (s?: string | null) => (s ?? '').toLowerCase().trim();

export function resolveSrdResource(
    homebrewType: HomebrewContentType,
    explicitResource?: string | null,
): string | null {
    if (explicitResource) return norm(explicitResource);
    return HOMEBREW_TYPE_TO_SRD_RESOURCE[homebrewType] ?? null;
}

export function inferSourceKind(
    content: Record<string, unknown>,
    explicit?: HomebrewSourceKind,
): HomebrewSourceKind {
    if (explicit) return explicit;
    const officialIndex = content.official_index ?? content._forkedFrom;
    if (!officialIndex) return 'original';
    const customIndex = content.index;
    if (typeof customIndex === 'string' && norm(customIndex) !== norm(String(officialIndex))) {
        return 'fork';
    }
    return 'translation';
}

export async function assertOfficialResourceExists(
    srdResource: string,
    sourceIndex: string,
): Promise<Record<string, unknown>> {
    const official = await SrdApi.get(srdResource, sourceIndex);
    if (!official || (typeof official === 'object' && Object.keys(official).length === 0)) {
        throw createError(
            404,
            `Recurso oficial não encontrado: ${srdResource}/${sourceIndex}. Verifique a 5e-srd-api.`,
        );
    }
    return official as Record<string, unknown>;
}

export function validateHomebrewPayload(
    homebrewType: HomebrewContentType,
    content: Record<string, unknown>,
    meta: HomebrewSourceMeta,
): void {
    if (homebrewType === 'translation') {
        return;
    }

    const srdResource = resolveSrdResource(homebrewType, meta.sourceResource);
    const sourceKind = meta.sourceKind ?? inferSourceKind(content);

    if (sourceKind === 'original') {
        const required = srdResource ? SRD_REQUIRED_INDEX_FIELDS[srdResource] : ['index', 'name'];
        const missing = required.filter(field => content[field] === undefined || content[field] === '');
        if (missing.length) {
            throw createError(
                400,
                `Conteúdo original incompleto para o padrão SRD (${srdResource ?? homebrewType}). Campos ausentes: ${missing.join(', ')}`,
            );
        }
        return;
    }

    if (!meta.sourceIndex && !content.official_index) {
        throw createError(400, 'Traduções e forks exigem sourceIndex ou official_index do SRD.');
    }

    if (sourceKind === 'translation' && srdResource) {
        const allowed = new Set(SRD_TRANSLATABLE_FIELDS[srdResource] ?? []);
        const provided = Object.keys(content).filter(
            key => !['official_index', 'index', 'locale', '_locale'].includes(key) && content[key] !== undefined,
        );
        const unexpected = provided.filter(key => allowed.size > 0 && !allowed.has(key));
        if (unexpected.length > 3) {
            console.warn(
                `[srdHomebrewValidator] Tradução com campos extras (serão mesclados): ${unexpected.join(', ')}`,
            );
        }
    }
}

export function buildContentFromSrd(
    official: Record<string, unknown>,
    sourceKind: HomebrewSourceKind,
    overrides: Record<string, unknown>,
    srdResource: string,
): Record<string, unknown> {
    const baseIndex = norm(String(official.index ?? ''));

    if (sourceKind === 'translation') {
        const allowed = SRD_TRANSLATABLE_FIELDS[srdResource] ?? ['name', 'desc'];
        const patch: Record<string, unknown> = {
            official_index: baseIndex,
            index: baseIndex,
        };
        for (const field of allowed) {
            if (overrides[field] !== undefined) {
                patch[field] = overrides[field];
            }
        }
        return patch;
    }

    if (sourceKind === 'fork') {
        const newIndex =
            typeof overrides.index === 'string' && overrides.index.trim()
                ? norm(overrides.index)
                : `${baseIndex}-fork-${Date.now()}`;
        return {
            ...official,
            ...overrides,
            official_index: baseIndex,
            index: newIndex,
            name: overrides.name ?? official.name,
        };
    }

    return {
        ...overrides,
        index: overrides.index ?? `${baseIndex}-custom-${Date.now()}`,
    };
}
