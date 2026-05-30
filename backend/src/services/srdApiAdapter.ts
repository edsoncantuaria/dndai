import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import {
    resolveSnapshotDir,
    snapshotFileForResource,
} from '../utils/srdSnapshotPaths.js';

export type SrdApiVersion = '2014' | '2024';

export interface SrdApiConfig {
    baseUrl: string;
    version: SrdApiVersion;
    offlineOnly: boolean;
    requestTimeoutMs: number;
}

const norm = (value?: string) => (value ?? '').toLowerCase().trim();

const defaultBase = () => {
    const fromEnv = process.env.SRD_API_BASE?.replace(/\/$/, '');
    if (fromEnv) return fromEnv;
    const version = process.env.SRD_API_VERSION === '2024' ? '2024' : '2014';
    return `http://localhost:3000/api/${version}`;
};

export const srdApiConfig: SrdApiConfig = {
    baseUrl: defaultBase(),
    version: process.env.SRD_API_VERSION === '2024' ? '2024' : '2014',
    offlineOnly: ['1', 'true', 'yes', 'on'].includes((process.env.SRD_OFFLINE_ONLY ?? '').toLowerCase()),
    requestTimeoutMs: Number(process.env.SRD_API_TIMEOUT_MS) || 15_000,
};

const snapshotCache = new Map<string, any[]>();

const loadSnapshotCollection = (resource: string): any[] => {
    const cacheKey = norm(resource.split('/')[0]);
    if (snapshotCache.has(cacheKey)) {
        return snapshotCache.get(cacheKey)!;
    }

    const dir = resolveSnapshotDir();
    if (!dir) {
        snapshotCache.set(cacheKey, []);
        return [];
    }

    const filePath = path.join(dir, snapshotFileForResource(resource));
    if (!fs.existsSync(filePath)) {
        console.warn(`[SrdApiAdapter] Snapshot ausente: ${filePath}`);
        snapshotCache.set(cacheKey, []);
        return [];
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const rows = Array.isArray(parsed) ? parsed : [];
        snapshotCache.set(cacheKey, rows);
        return rows;
    } catch (error) {
        console.error(`[SrdApiAdapter] Falha ao ler snapshot ${filePath}:`, error);
        snapshotCache.set(cacheKey, []);
        return [];
    }
};

const findSnapshotEntry = (resource: string, index: string): any | null => {
    const segments = resource.split('/').filter(Boolean);
    const rootResource = segments[0];
    const collection = loadSnapshotCollection(rootResource);

    if (segments.length === 1) {
        return collection.find(entry => norm(entry.index) === norm(index)) ?? null;
    }

    const parentIndex = segments[1];
    const parent = collection.find(entry => norm(entry.index) === norm(parentIndex));
    if (!parent) return null;

    if (index === 'levels' && Array.isArray(parent.levels)) {
        return parent.levels;
    }
    if (index === 'spells' && Array.isArray(parent.spells)) {
        return parent.spells;
    }
    if (index === 'features' && Array.isArray(parent.features)) {
        return parent.features;
    }
    if (index === 'starting-equipment' && parent.starting_equipment) {
        return parent.starting_equipment;
    }
    if (index === 'multi-classing' && parent.multi_classing) {
        return parent.multi_classing;
    }
    if (index === 'subclasses' && Array.isArray(parent.subclasses)) {
        return parent.subclasses;
    }
    if (index === 'proficiencies' && Array.isArray(parent.proficiencies)) {
        return parent.proficiencies;
    }
    if (index === 'spellcasting' && parent.spellcasting) {
        return parent.spellcasting;
    }

  return parent[index] ?? parent[norm(index)] ?? null;
};

const buildApiPath = (resource: string, index?: string): string => {
    const cleanResource = resource.replace(/^\/+|\/+$/g, '');
    if (!index) return `/${cleanResource}`;
    return `/${cleanResource}/${index.replace(/^\/+|\/+$/g, '')}`;
};

async function fetchFromApi<T>(apiPath: string): Promise<T | null> {
    const url = `${srdApiConfig.baseUrl}${apiPath}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), srdApiConfig.requestTimeoutMs);

    try {
        const response = await fetch(url, {
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        });
        if (!response.ok) {
            console.error(`[SrdApiAdapter] HTTP ${response.status} em ${url}`);
            return null;
        }
        return (await response.json()) as T;
    } catch (error) {
        console.error(`[SrdApiAdapter] Falha ao buscar ${url}:`, error);
        return null;
    } finally {
        clearTimeout(timer);
    }
}

export async function checkSrdApiHealth(): Promise<{
    ok: boolean;
    baseUrl: string;
    version: SrdApiVersion;
    mode: 'online' | 'offline';
    latencyMs?: number;
    collections?: string[];
    error?: string;
}> {
    if (srdApiConfig.offlineOnly) {
        const dir = resolveSnapshotDir();
        return {
            ok: Boolean(dir),
            baseUrl: srdApiConfig.baseUrl,
            version: srdApiConfig.version,
            mode: 'offline',
            error: dir ? undefined : 'Nenhum snapshot local encontrado',
        };
    }

    const started = Date.now();
    const root = await fetchFromApi<Record<string, string>>('/');
    const latencyMs = Date.now() - started;

    if (!root || typeof root !== 'object') {
        const dir = resolveSnapshotDir();
        return {
            ok: Boolean(dir),
            baseUrl: srdApiConfig.baseUrl,
            version: srdApiConfig.version,
            mode: 'offline',
            latencyMs,
            error: dir
                ? 'API indisponível — usando snapshot local'
                : 'API indisponível e sem snapshot local',
        };
    }

    return {
        ok: true,
        baseUrl: srdApiConfig.baseUrl,
        version: srdApiConfig.version,
        mode: 'online',
        latencyMs,
        collections: Object.keys(root),
    };
}

const preferLocalSnapshot = (): boolean =>
    srdApiConfig.offlineOnly || Boolean(resolveSnapshotDir());

export async function list(resource: string): Promise<{ count: number; results: any[] } | null> {
    const normalizedResource = norm(resource);

    if (!preferLocalSnapshot()) {
        const online = await fetchFromApi<{ count?: number; results?: any[] }>(
            buildApiPath(normalizedResource),
        );
        if (online?.results) {
            return {
                count: online.count ?? online.results.length,
                results: online.results,
            };
        }
    }

    const snapshot = loadSnapshotCollection(normalizedResource);
    if (!snapshot.length) return null;

    const results = snapshot.map(entry => ({
        index: entry.index,
        name: entry.name,
        url: entry.url ?? `${srdApiConfig.baseUrl}/${normalizedResource}/${entry.index}`,
    }));

    return { count: results.length, results };
}

export async function get(resource: string, index: string): Promise<any | null> {
    const normalizedResource = resource.replace(/^\/+|\/+$/g, '');
    const normalizedIndex = index.replace(/^\/+|\/+$/g, '');

    const offline = findSnapshotEntry(normalizedResource, normalizedIndex);

    if (preferLocalSnapshot()) {
        return offline;
    }

    const online = await fetchFromApi<any>(buildApiPath(normalizedResource, normalizedIndex));
    if (online != null) {
        return online;
    }

    return offline;
}

/** Alias explícito para rotas aninhadas (classes/fighter + levels). */
export async function getNested(
    resource: string,
    index: string,
    subresource?: string,
): Promise<any | null> {
    const fullResource = subresource
        ? `${resource.replace(/^\/+|\/+$/g, '')}/${index.replace(/^\/+|\/+$/g, '')}`
        : resource.replace(/^\/+|\/+$/g, '');
    const finalIndex = subresource ?? index;
    return get(fullResource, finalIndex.replace(/^\/+|\/+$/g, ''));
}

export function clearSnapshotCache() {
    snapshotCache.clear();
}
