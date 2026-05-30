import type { NpcAtributosPt, NpcSrdBuild } from './npcSheet.js';
import { proficiencyBonusForLevel, type NpcArchetype } from './npcSheet.js';
import { classProfileFromRole, spellSlotsForNpcLevel, spellsForNpcClass } from './npcClassProfile.js';
import type { NpcWeaponDef } from './npcSheet.js';
import { filterValidNpcSpells } from './npcSrdSpells.js';

export const ALLOWED_NPC_WEAPON_SLUGS = new Set([
    'shortsword',
    'dagger',
    'mace',
    'spear',
    'shortbow',
    'quarterstaff',
    'longsword',
]);

export type NpcAiSheetInput = {
    atributos: NpcAtributosPt;
    level?: number;
    armorClass?: number;
    characterClass?: string;
    characterClassLabel?: string;
    isSpellcaster?: boolean;
    spells?: string[];
    mainWeaponSlug?: string;
};

const CLASS_LABELS: Record<string, string> = {
    fighter: 'Guerreiro',
    rogue: 'Ladino',
    wizard: 'Mago',
    cleric: 'Clérigo',
    bard: 'Bardo',
    commoner: 'Plebeu',
};

function clampScore(n: number): number {
    return Math.max(6, Math.min(20, Math.round(n)));
}

export function parseAiAtributos(raw: unknown): NpcAtributosPt | null {
    let o: Record<string, unknown> | null = null;
    if (typeof raw === 'string') {
        try {
            o = JSON.parse(raw) as Record<string, unknown>;
        } catch {
            return null;
        }
    } else if (raw && typeof raw === 'object') {
        o = raw as Record<string, unknown>;
    }
    if (!o) return null;

    const pick = (keys: string[]) => {
        for (const k of keys) {
            const v = o![k];
            if (v === undefined || v === null) continue;
            const n = typeof v === 'number' ? v : Number(String(v).trim());
            if (!Number.isNaN(n)) return clampScore(n);
        }
        return null;
    };
    const forca = pick(['forca', 'força', 'FOR', 'strength', 'str']);
    const destreza = pick(['destreza', 'DES', 'dexterity', 'dex']);
    const constituicao = pick(['constituicao', 'constituição', 'CON', 'constitution', 'con']);
    const inteligencia = pick(['inteligencia', 'inteligência', 'INT', 'intelligence', 'int']);
    const sabedoria = pick(['sabedoria', 'SAB', 'wisdom', 'wis']);
    const carisma = pick(['carisma', 'CAR', 'charisma', 'cha']);
    if (
        forca == null ||
        destreza == null ||
        constituicao == null ||
        inteligencia == null ||
        sabedoria == null ||
        carisma == null
    ) {
        return null;
    }
    return { forca, destreza, constituicao, inteligencia, sabedoria, carisma };
}

export function parseAiNpcSheet(raw: {
    atributos?: unknown;
    level?: number;
    armorClass?: number;
    characterClass?: string;
    characterClassLabel?: string;
    isSpellcaster?: boolean;
    spells?: string[];
    mainWeaponSlug?: string;
}): NpcAiSheetInput | null {
    const attrRaw =
        raw.atributos ??
        (raw as { attributes?: unknown }).attributes ??
        (raw as { atributo?: unknown }).atributo;
    const atributos = parseAiAtributos(attrRaw);
    if (!atributos) return null;
    const spells = filterValidNpcSpells(
        Array.isArray(raw.spells) ? raw.spells.map(s => String(s).trim()) : undefined,
    );
    const isSpellcaster = raw.isSpellcaster === true || spells.length > 0;
    return {
        atributos,
        level:
            typeof raw.level === 'number'
                ? Math.max(1, Math.min(20, Math.round(raw.level)))
                : undefined,
        armorClass:
            typeof raw.armorClass === 'number'
                ? Math.max(8, Math.min(22, Math.round(raw.armorClass)))
                : undefined,
        characterClass: raw.characterClass?.trim().toLowerCase(),
        characterClassLabel: raw.characterClassLabel?.trim(),
        isSpellcaster,
        spells: isSpellcaster ? spells : [],
        mainWeaponSlug: raw.mainWeaponSlug?.trim().toLowerCase(),
    };
}

function atributosToSrdAttributes(a: NpcAtributosPt): NpcSrdBuild['attributes'] {
    return {
        strength: a.forca,
        dexterity: a.destreza,
        constitution: a.constituicao,
        intelligence: a.inteligencia,
        wisdom: a.sabedoria,
        charisma: a.carisma,
    };
}

function abilityMod(score: number): number {
    return Math.floor((score - 10) / 2);
}

/** Aplica ficha gerada pela IA sobre o esqueleto mecânico (arma/validação no servidor). */
export function mergeAiSheetIntoSrdBuild(
    base: NpcSrdBuild,
    ai: NpcAiSheetInput,
    role: string,
    archetype: NpcArchetype,
): NpcSrdBuild {
    const level = ai.level ?? base.level;
    const attributes = atributosToSrdAttributes(ai.atributos);
    const classKey = ai.characterClass ?? base.characterClass;
    const characterClassLabel =
        ai.characterClassLabel ?? CLASS_LABELS[classKey] ?? base.characterClassLabel;
    const profile = classProfileFromRole(role, archetype);
    const isSpellcaster = ai.isSpellcaster ?? profile.isSpellcaster;
    let spells = isSpellcaster
        ? filterValidNpcSpells(ai.spells?.length ? ai.spells : spellsForNpcClass(classKey, level))
        : [];

    const dexMod = abilityMod(attributes.dexterity);
    const ac = ai.armorClass ?? 10 + dexMod + (classKey === 'fighter' ? 3 : classKey === 'rogue' ? 1 : 0);

    return {
        ...base,
        level,
        attributes,
        atributos: ai.atributos,
        characterClass: classKey,
        characterClassLabel,
        isSpellcaster,
        spells,
        spellSlots: isSpellcaster ? spellSlotsForNpcLevel(level, classKey) : {},
        proficiencyBonus: proficiencyBonusForLevel(level),
        ac,
    };
}

export function resolveWeaponFromAiSlug(slug: string | undefined, fallback: NpcWeaponDef): NpcWeaponDef {
    if (!slug || !ALLOWED_NPC_WEAPON_SLUGS.has(slug)) return fallback;
    const names: Record<string, string> = {
        shortsword: 'Espada curta',
        dagger: 'Adaga',
        mace: 'Maça',
        spear: 'Lança',
        shortbow: 'Arco curto',
        quarterstaff: 'Bordão',
        longsword: 'Espada longa',
    };
    const damages: Record<string, { damage: string; damageType: string }> = {
        shortsword: { damage: '1d6', damageType: 'slashing' },
        dagger: { damage: '1d4', damageType: 'piercing' },
        mace: { damage: '1d6', damageType: 'bludgeoning' },
        spear: { damage: '1d6', damageType: 'piercing' },
        shortbow: { damage: '1d6', damageType: 'piercing' },
        quarterstaff: { damage: '1d6', damageType: 'bludgeoning' },
        longsword: { damage: '1d8', damageType: 'slashing' },
    };
    const d = damages[slug] ?? { damage: '1d6', damageType: 'slashing' };
    return {
        itemKey: slug,
        name: names[slug] ?? slug,
        quantity: 1,
        equipped: true,
        itemData: { type: 'weapon', ...d, category: 'simple' },
    };
}
