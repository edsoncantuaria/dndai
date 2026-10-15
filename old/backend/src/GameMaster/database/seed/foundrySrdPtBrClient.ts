/**
 * Cliente para compendiums Foundry SRD PT (decito/dnd5e-pt-br).
 * CC BY 4.0 — SRD Wizards + tradução comunitária.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const FOUNDRY_REPO = 'decito/dnd5e-pt-br';
export const FOUNDRY_REF = 'main';
export const FOUNDRY_CACHE_DIR = join(__dirname, '../../../../.tmp/foundry-decito');

export const FOUNDRY_COMPENDIUM_FILES = [
    'dnd5e.races.json',
    'dnd5e.spells.json',
    'dnd5e.items.json',
    'dnd5e.monsters.json',
    'dnd5e.classfeatures.json',
    'dnd5e.classes.json',
    'dnd5e.subclasses.json',
] as const;

export type FoundryCompendiumEntry = {
    name?: string;
    label?: string;
    description?: string;
};

export type FoundryCompendium = {
    entries: Record<string, FoundryCompendiumEntry>;
};

export function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/'/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

/** Chave normalizada para casar features Foundry (EN) ↔ SRD (EN com sufixos). */
export function normFeatureKey(name: string): string {
    return name
        .toLowerCase()
        .replace(/^fighting style:\s*/i, '')
        .replace(/\s*\(\d+\s*uses?\)/i, '')
        .replace(/\s*\(\d+\s*dice?\)/i, '')
        .replace(/\s*\(d\d+\)/i, '')
        .replace(/\s*\(1\s*use\)/i, '')
        .trim();
}

export function htmlToPlain(html: string): string {
    return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/@Compendium\[[^\]]+\]\{([^}]+)\}/g, '$1')
        .replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, '$1')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
}

export function htmlToDescArray(html: string): string[] {
    const plain = htmlToPlain(html);
    if (!plain) return [];
    const parts = plain
        .split(/\n{2,}/)
        .map(p => p.replace(/\s+/g, ' ').trim())
        .filter(p => p.length > 0);
    return parts.length > 0 ? parts : [plain];
}

async function fetchJson(url: string, cachePath: string): Promise<unknown> {
    mkdirSync(dirname(cachePath), { recursive: true });
    if (existsSync(cachePath)) {
        return JSON.parse(readFileSync(cachePath, 'utf-8')) as unknown;
    }
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Falha ao baixar ${url}: HTTP ${res.status}`);
    }
    const text = await res.text();
    writeFileSync(cachePath, text, 'utf-8');
    return JSON.parse(text) as unknown;
}

export async function loadFoundryCompendium(
    fileName: string,
    options?: { skipFetch?: boolean },
): Promise<FoundryCompendium> {
    const cachePath = join(FOUNDRY_CACHE_DIR, fileName);
    if (options?.skipFetch && !existsSync(cachePath)) {
        throw new Error(`Cache ausente em ${cachePath} — rode import sem skipFetch.`);
    }
    const base = `https://raw.githubusercontent.com/${FOUNDRY_REPO}/${FOUNDRY_REF}`;
    const url = `${base}/compendium/${fileName}`;
    return (await fetchJson(url, cachePath)) as FoundryCompendium;
}

export async function prefetchAllFoundryCompendiums(options?: {
    skipFetch?: boolean;
}): Promise<string[]> {
    const loaded: string[] = [];
    for (const file of FOUNDRY_COMPENDIUM_FILES) {
        await loadFoundryCompendium(file, options);
        loaded.push(file);
    }
    return loaded;
}
