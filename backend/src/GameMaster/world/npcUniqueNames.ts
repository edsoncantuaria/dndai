import { PenaiDataSource } from '../database/data-source.js';
import { WorldEntity } from '../database/entities/WorldEntity.js';
import { formatNpcDisplayName, parseNpcDisplayName } from './npcDisplayName.js';
import type { BootstrapNpcDraft } from './agents/worldBootstrapNpcAgent.js';
import { randomUUID } from 'crypto';
import { takeUniqueGivenNames } from './npcGlobalGivenNamePool.js';

/** Pool expandido para seed em massa (evita repetir Uldric/Haldor em 28 regiões). */
export const NPC_GIVEN_NAME_POOL = [
    'Uldric', 'Bruna', 'Tomas', 'Lia', 'Orin', 'Haldor', 'Mira', 'Kael', 'Sera', 'Dain',
    'Elara', 'Viktor', 'Nessa', 'Rurik', 'Yara', 'Pavel', 'Isla', 'Garrick', 'Thora', 'Cedric',
    'Anya', 'Breno', 'Cora', 'Dorian', 'Eira', 'Finn', 'Greta', 'Henrik', 'Ivara', 'Joren',
    'Alaric', 'Bastian', 'Cael', 'Dessa', 'Eldon', 'Fiora', 'Gideon', 'Helia', 'Ivan', 'Jaspar',
    'Kira', 'Leandro', 'Maia', 'Niall', 'Oriana', 'Petra', 'Quinn', 'Rowan', 'Silas', 'Talia',
    'Ulma', 'Vera', 'Willem', 'Xara', 'Yorick', 'Zara', 'Alden', 'Blythe', 'Ciro', 'Dagna',
    'Ewan', 'Freya', 'Galen', 'Hestia', 'Ines', 'Jarl', 'Kestrel', 'Liora', 'Marek', 'Nadia',
];

/** Nome próprio sem sufixos regionais repetidos ("Uldric de selva" → "Uldric"). */
export function baseGivenNameFromLabel(name: string): string {
    const trimmed = name.trim();
    const idx = trimmed.toLowerCase().lastIndexOf(' de ');
    if (idx > 0) return trimmed.slice(0, idx).trim();
    return trimmed;
}

/** Etiqueta regional curta e específica (últimos segmentos do slug). */
export function regionDisambiguatorTag(regionSlug: string): string {
    const parts = regionSlug.split('-').filter(Boolean);
    if (parts.length === 0) return regionSlug;
    if (parts.length === 1) return parts[0]!;
    return parts.slice(-2).join(' ');
}

export async function loadReservedNpcGivenNames(): Promise<Set<string>> {
    const rows = await PenaiDataSource.getRepository(WorldEntity)
        .createQueryBuilder('e')
        .select(['e.displayName', 'e.stats'])
        .where("e.entityType = 'npc'")
        .andWhere("e.statusGlobal = 'alive'")
        .getMany();

    const reserved = new Set<string>();
    for (const row of rows) {
        const stats = row.stats as Record<string, unknown> | undefined;
        const fromStats = typeof stats?.givenName === 'string' ? stats.givenName : '';
        const parsed = parseNpcDisplayName(row.displayName);
        const name = (fromStats || parsed.givenName).trim().toLowerCase();
        if (name) reserved.add(name);
    }
    return reserved;
}

/** Garante nome próprio único — prefere pool global (sem "de região" nem "Nome 2"). */
export function ensureUniqueGivenName(
    baseName: string,
    reserved: Set<string>,
    _disambiguator?: string,
): string {
    const base = baseGivenNameFromLabel(baseName) || 'Desconhecido';
    const key = base.toLowerCase();
    if (!reserved.has(key)) {
        reserved.add(key);
        return base;
    }

    const [fromPool] = takeUniqueGivenNames(1, reserved);
    if (fromPool) return fromPool;

    const fallback = `Viajante-${randomUUID().slice(0, 4)}`;
    reserved.add(fallback.toLowerCase());
    return fallback;
}

export function dedupeNpcDrafts(
    drafts: BootstrapNpcDraft[],
    reserved: Set<string>,
    _regionSlug: string,
): BootstrapNpcDraft[] {
    const seenDisplay = new Set<string>();

    return drafts.map(d => {
        const seedName = baseGivenNameFromLabel(d.givenName);
        let givenName = ensureUniqueGivenName(seedName, reserved);
        const roleTitle = d.roleTitle;
        let displayName = formatNpcDisplayName(givenName, roleTitle);

        let guard = 0;
        while (seenDisplay.has(displayName.toLowerCase()) && guard < 20) {
            guard += 1;
            givenName = ensureUniqueGivenName(seedName, reserved);
            displayName = formatNpcDisplayName(givenName, roleTitle);
        }
        seenDisplay.add(displayName.toLowerCase());

        return {
            ...d,
            givenName,
            roleTitle,
            displayName,
        };
    });
}

export function pickProceduralGivenName(_index: number, reserved: Set<string>, _regionSlug?: string): string {
    const [name] = takeUniqueGivenNames(1, reserved);
    return name ?? ensureUniqueGivenName('Viajante', reserved);
}
