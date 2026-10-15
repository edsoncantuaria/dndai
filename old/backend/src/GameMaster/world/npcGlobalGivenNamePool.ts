/**
 * Pool global de nomes próprios (560+) — um nome por NPC no mundo, sem sufixos regionais.
 */

const PREFIXES = [
    'Ael', 'Ara', 'Ash', 'Bryn', 'Cael', 'Cor', 'Dain', 'Eira', 'El', 'Fael',
    'Fen', 'Garr', 'Gor', 'Hal', 'Hel', 'Ior', 'Iva', 'Jor', 'Kael', 'Kor',
    'Lin', 'Lyr', 'Mor', 'Myr', 'Nael', 'Nys', 'Or', 'Oren', 'Pir', 'Pry',
    'Quen', 'Rol', 'Ryn', 'Sel', 'Syl', 'Thal', 'Tor', 'Ulf', 'Val', 'Vex',
    'Wyn', 'Ys', 'Zeph', 'Brae', 'Drin', 'Jara', 'Nira', 'Soren', 'Tavian', 'Vale',
] as const;

const SUFFIXES = [
    'an', 'ar', 'el', 'en', 'ia', 'ic', 'il', 'in', 'ir', 'is',
    'on', 'or', 'os', 'us', 'yn', 'eth', 'ric', 'ven', 'dor', 'mir',
] as const;

/** Nomes curados (prioridade no pool). */
const CURATED = [
    'Uldric', 'Bruna', 'Tomas', 'Lia', 'Orin', 'Haldor', 'Mira', 'Kael', 'Sera', 'Dain',
    'Elara', 'Viktor', 'Nessa', 'Rurik', 'Yara', 'Pavel', 'Isla', 'Garrick', 'Thora', 'Cedric',
    'Anya', 'Breno', 'Cora', 'Dorian', 'Eira', 'Finn', 'Greta', 'Henrik', 'Ivara', 'Joren',
    'Alaric', 'Bastian', 'Cael', 'Dessa', 'Eldon', 'Fiora', 'Gideon', 'Helia', 'Ivan', 'Jaspar',
    'Kira', 'Leandro', 'Maia', 'Niall', 'Oriana', 'Petra', 'Quinn', 'Rowan', 'Silas', 'Talia',
    'Ulma', 'Vera', 'Willem', 'Xara', 'Yorick', 'Zara', 'Aldric', 'Blythe', 'Ciro', 'Dagna',
    'Ewan', 'Freya', 'Galen', 'Hestia', 'Ines', 'Jarl', 'Kestrel', 'Liora', 'Marek', 'Nadia',
    'Faelar', 'Nyala', 'Rakan', 'Iri', 'Torren', 'Maela', 'Voss', 'Roric', 'Saskia', 'Theron',
    'Ulric', 'Vanya', 'Wren', 'Xander', 'Ysolde', 'Zarek', 'Aric', 'Bran', 'Caden', 'Dara',
    'Elowen', 'Falk', 'Giselle', 'Hugo', 'Isolde', 'Jasper', 'Kaelen', 'Luna', 'Miraen', 'Nolan',
    'Oswin', 'Perrin', 'Rhea', 'Stellan', 'Tamsin', 'Una', 'Vesper', 'Willa', 'Ximena', 'Yorin',
] as const;

function buildCombinatorialPool(): string[] {
    const out = new Set<string>();
    for (const p of PREFIXES) {
        for (const s of SUFFIXES) {
            const name = `${p}${s}`;
            if (name.length >= 3 && name.length <= 12) out.add(name);
        }
    }
    return [...out];
}

function buildGlobalPool(): string[] {
    const seen = new Set<string>();
    const ordered: string[] = [];
    const push = (n: string) => {
        const key = n.toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            ordered.push(n);
        }
    };
    for (const n of CURATED) push(n);
    for (const n of buildCombinatorialPool()) push(n);
    return ordered;
}

export const NPC_GLOBAL_GIVEN_NAMES: readonly string[] = buildGlobalPool();

export function takeUniqueGivenNames(count: number, reserved: Set<string>): string[] {
    const out: string[] = [];
    for (const name of NPC_GLOBAL_GIVEN_NAMES) {
        if (out.length >= count) break;
        const key = name.toLowerCase();
        if (reserved.has(key)) continue;
        reserved.add(key);
        out.push(name);
    }
    if (out.length < count) {
        throw new Error(
            `Pool global de nomes esgotado: pedidos ${count}, obtidos ${out.length} (reservados ${reserved.size})`,
        );
    }
    return out;
}

/** Reserva nomes já usados (catálogo manual, banco, etc.). */
export function reserveGivenNames(names: Iterable<string>, reserved: Set<string>): void {
    for (const n of names) {
        const base = n.trim();
        if (base) reserved.add(base.toLowerCase());
    }
}
