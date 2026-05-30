import fs from 'fs';
import path from 'path';
import { resolveSnapshotDir } from '../../utils/srdSnapshotPaths.js';

const DND5E_SPELLS_API = 'https://www.dnd5eapi.co/api/2014/spells';

type SpellEntry = { index: string; name: string };

let byIndex: Map<string, SpellEntry> | null = null;
let byLookupKey: Map<string, string> | null = null;

function lookupKey(value: string): string {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function spellsJsonPath(): string | null {
    const dir = resolveSnapshotDir();
    if (!dir) return null;
    const p = path.join(dir, 'spells.json');
    return fs.existsSync(p) ? p : null;
}

function loadSpellsFromSnapshot(): SpellEntry[] {
    const file = spellsJsonPath();
    if (!file) return [];
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as Array<{ index?: string; name?: string }>;
    return raw
        .filter(s => typeof s.index === 'string' && typeof s.name === 'string')
        .map(s => ({ index: s.index!, name: s.name! }));
}

function indexFromRef(ref: string): string {
    return ref
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function registerCatalog(entries: SpellEntry[]): void {
    byIndex = new Map();
    byLookupKey = new Map();
    for (const e of entries) {
        byIndex.set(e.index, e);
        byLookupKey.set(lookupKey(e.index), e.index);
        byLookupKey.set(lookupKey(e.index.replace(/-/g, ' ')), e.index);
        byLookupKey.set(lookupKey(e.name), e.index);
    }
}

/** Catálogo SRD 2014 (mesmo índice que dnd5eapi.co/api/2014/spells). */
export function ensureNpcSpellCatalog(): void {
    if (byIndex) return;
    registerCatalog(loadSpellsFromSnapshot());
}

/** Atualiza catálogo a partir da API pública (opcional; snapshot local é o default). */
export async function refreshNpcSpellCatalogFromApi(): Promise<number> {
    const res = await fetch(DND5E_SPELLS_API);
    if (!res.ok) {
        throw new Error(`dnd5eapi spells: HTTP ${res.status}`);
    }
    const body = (await res.json()) as { results?: Array<{ index: string; url: string }> };
    const results = body.results ?? [];
    const entries: SpellEntry[] = [];
    for (const r of results) {
        const detail = await fetch(`https://www.dnd5eapi.co${r.url}`);
        if (!detail.ok) continue;
        const spell = (await detail.json()) as { index?: string; name?: string };
        if (spell.index && spell.name) {
            entries.push({ index: spell.index, name: spell.name });
        }
    }
    if (entries.length) registerCatalog(entries);
    return entries.length;
}

/** Resolve índice SRD (kebab-case) a partir de index ou nome em inglês da API. */
export function resolveNpcSpellRef(ref: string): string | null {
    if (!ref?.trim()) return null;
    ensureNpcSpellCatalog();
    if (!byIndex?.size) return null;

    const asIndex = indexFromRef(ref);
    if (byIndex.has(asIndex)) return asIndex;

    const key = lookupKey(ref);
    return byLookupKey?.get(key) ?? null;
}

export function filterValidNpcSpells(raw: string[] | undefined): string[] {
    if (!Array.isArray(raw)) return [];
    const out: string[] = [];
    for (const item of raw) {
        const idx = resolveNpcSpellRef(String(item));
        if (idx && !out.includes(idx)) out.push(idx);
    }
    return out;
}

export function getNpcSpellDisplayName(index: string): string {
    ensureNpcSpellCatalog();
    return byIndex?.get(index)?.name ?? index;
}

export function listNpcSpellIndices(): string[] {
    ensureNpcSpellCatalog();
    return [...(byIndex?.keys() ?? [])].sort();
}

export const NPC_SPELL_CATALOG_URL = DND5E_SPELLS_API;
