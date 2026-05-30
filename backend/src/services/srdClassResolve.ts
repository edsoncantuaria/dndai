import { getSrdResource, listSrdResources } from './srdCatalogService.js';

/** Nomes PT-BR e variantes → índice SRD 2014 (inglês). */
export const SRD_CLASS_ALIAS: Record<string, string> = {
    barbaro: 'barbarian',
    bardo: 'bard',
    clerigo: 'cleric',
    druida: 'druid',
    guerreiro: 'fighter',
    ladino: 'rogue',
    monge: 'monk',
    paladino: 'paladin',
    patrulheiro: 'ranger',
    patrulheira: 'ranger',
    feiticeiro: 'sorcerer',
    mago: 'wizard',
    bruxo: 'warlock',
    bruxa: 'warlock',
};

export function normalizeSrdToken(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
}

/** Resolve rótulo de classe (PT ou EN) para índice SRD (`rogue`, `fighter`, …). */
export function resolveSrdClassIndex(raw: unknown): string {
    if (typeof raw !== 'string' || !raw.trim()) return '';
    const token = normalizeSrdToken(raw);
    if (!token) return '';
    if (SRD_CLASS_ALIAS[token]) return SRD_CLASS_ALIAS[token];
    return token;
}

export function resolveSrdSubclassIndex(raw: unknown): string {
    if (typeof raw !== 'string' || !raw.trim()) return '';
    return raw
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function levelsFromEntry(entry: { levels?: unknown[] } | null | undefined): unknown[] {
    return entry?.levels && Array.isArray(entry.levels) ? entry.levels : [];
}

/** Níveis de classe a partir do snapshot local / catálogo (sem HTTP). */
export async function loadSrdClassLevels(classIndex: string): Promise<unknown[]> {
    if (!classIndex) return [];
    const direct = await getSrdResource('classes', classIndex);
    const fromDirect = levelsFromEntry(direct);
    if (fromDirect.length) return fromDirect;

    const all = await listSrdResources('classes');
    const found = all.find((c: { index?: string }) => c.index === classIndex);
    return levelsFromEntry(found);
}

/** Níveis de subclasse a partir do snapshot local / catálogo (sem HTTP). */
export async function loadSrdSubclassLevels(subclassIndex: string): Promise<unknown[]> {
    if (!subclassIndex) return [];
    const direct = await getSrdResource('subclasses', subclassIndex);
    const fromDirect = levelsFromEntry(direct);
    if (fromDirect.length) return fromDirect;

    const all = await listSrdResources('subclasses');
    const found = all.find((s: { index?: string }) => s.index === subclassIndex);
    return levelsFromEntry(found);
}
