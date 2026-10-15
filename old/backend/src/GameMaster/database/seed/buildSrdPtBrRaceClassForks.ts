/**
 * Gera overlays PT (translation) para raças, sub-raças, classes e subclasses SRD 2014.
 * Nomes e rótulos aninhados vêm de TranslatorPTBR; desc completa pode ser acrescentada
 * em backend/data/srdPtBr/overrides/{resource}/{index}.json (manual, incremental).
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { requireSnapshotDir } from '../../../utils/srdSnapshotPaths.js';
import { TRANSLATIONS_BASE } from '../../../../data/TranslatorPTBR.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OVERRIDES_DIR = join(__dirname, '../../../../data/srdPtBr/overrides');

const SIZE_MAP: Record<string, string> = {
    Medium: 'Médio',
    Small: 'Pequeno',
    Large: 'Grande',
    Tiny: 'Minúsculo',
    Huge: 'Enorme',
};

export type SrdPtBrForkRow = {
    type: 'race' | 'subrace' | 'class' | 'subclass';
    name: string;
    content: Record<string, unknown>;
    sourceIndex: string;
    sourceResource: string;
};

function loadJson<T>(fileName: string): T {
    return JSON.parse(readFileSync(join(requireSnapshotDir(), fileName), 'utf-8')) as T;
}

function buildNameMap(): Map<string, string> {
    const map = new Map<string, string>();
    for (const category of Object.values(TRANSLATIONS_BASE)) {
        for (const [en, pt] of Object.entries(category)) {
            map.set(en, pt);
        }
    }
    return map;
}

function translateNamesDeep(value: unknown, nameMap: Map<string, string>): unknown {
    if (Array.isArray(value)) {
        return value.map(entry => translateNamesDeep(entry, nameMap));
    }
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
            if (key === 'name' && typeof nested === 'string') {
                out[key] = nameMap.get(nested) ?? nested;
            } else if (key === 'size' && typeof nested === 'string') {
                out[key] = SIZE_MAP[nested] ?? nested;
            } else {
                out[key] = translateNamesDeep(nested, nameMap);
            }
        }
        return out;
    }
    return value;
}

function loadManualOverride(resource: string, index: string): Record<string, unknown> | null {
    const path = join(OVERRIDES_DIR, resource, `${index}.json`);
    if (!existsSync(path)) return null;
    try {
        return loadJson<Record<string, unknown>>(path);
    } catch {
        return null;
    }
}

function buildFork(
    type: SrdPtBrForkRow['type'],
    sourceResource: string,
    official: Record<string, unknown>,
    nameMap: Map<string, string>,
): SrdPtBrForkRow | null {
    const index = String(official.index ?? '').trim();
    if (!index) return null;

    const enName = String(official.name ?? index);
    const ptName = nameMap.get(enName) ?? enName;
    const translated = translateNamesDeep(official, nameMap) as Record<string, unknown>;
    const manual = loadManualOverride(sourceResource, index);

    const content: Record<string, unknown> = {
        ...translated,
        index,
        official_index: index,
        name: manual?.name ?? ptName,
        ...(manual ?? {}),
    };

    return {
        type,
        name: String(content.name ?? ptName),
        content,
        sourceIndex: index,
        sourceResource,
    };
}

export function buildSrdPtBrRaceClassForks(): SrdPtBrForkRow[] {
    const nameMap = buildNameMap();
    const rows: SrdPtBrForkRow[] = [];

    for (const race of loadJson<Record<string, unknown>[]>('races.json')) {
        const row = buildFork('race', 'races', race, nameMap);
        if (row) rows.push(row);
    }
    for (const subrace of loadJson<Record<string, unknown>[]>('subraces.json')) {
        const row = buildFork('subrace', 'subraces', subrace, nameMap);
        if (row) rows.push(row);
    }
    for (const cls of loadJson<Record<string, unknown>[]>('classes.json')) {
        const row = buildFork('class', 'classes', cls, nameMap);
        if (row) rows.push(row);
    }
    for (const sub of loadJson<Record<string, unknown>[]>('subclasses.json')) {
        const row = buildFork('subclass', 'subclasses', sub, nameMap);
        if (row) rows.push(row);
    }

    return rows;
}
