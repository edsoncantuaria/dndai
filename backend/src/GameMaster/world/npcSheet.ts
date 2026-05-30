import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { WorldEntity } from '../database/entities/WorldEntity.js';
import { SessionEntityState } from '../database/entities/SessionEntityState.js';
import type { EntityTier } from '../database/entities/types/EntityTier.js';
import type { BootstrapNpcDraft } from './agents/worldBootstrapNpcAgent.js';
import type { NpcInventoryEntry, NpcSessionOverlay } from './npcSessionOverlay.js';
import { formatNpcDisplayName, parseNpcDisplayName } from './npcDisplayName.js';
import {
    classProfileFromRole,
    spellSlotsForNpcLevel,
    spellsForNpcClass,
} from './npcClassProfile.js';
import {
    mergeAiSheetIntoSrdBuild,
    resolveWeaponFromAiSlug,
    type NpcAiSheetInput,
} from './npcAiSheet.js';

export type { NpcAiSheetInput } from './npcAiSheet.js';

export type NpcArchetype = 'commoner' | 'guard' | 'expert' | 'scout' | 'acolyte' | 'veteran';

export type NpcWeaponDef = {
    itemKey: string;
    name: string;
    quantity: number;
    equipped: boolean;
    itemData: Record<string, unknown>;
};

/** Atributos PT-BR (exibição) + chaves SRD (motor/combate). */
export type NpcAtributosPt = {
    forca: number;
    destreza: number;
    constituicao: number;
    inteligencia: number;
    sabedoria: number;
    carisma: number;
};

export type NpcSrdBuild = {
    level: number;
    archetype: NpcArchetype;
    role: string;
    race: string;
    raceLabel: string;
    characterClass: string;
    characterClassLabel: string;
    isSpellcaster: boolean;
    /** Chaves compatíveis com `formatMechanicalPack` do herói. */
    attributes: {
        strength: number;
        dexterity: number;
        constitution: number;
        intelligence: number;
        wisdom: number;
        charisma: number;
    };
    /** Rótulos PT-BR para narração/UI. */
    atributos: NpcAtributosPt;
    proficiencyBonus: number;
    ac: number;
    maxHp: number;
    hp: number;
    spells: string[];
    spellSlots: Record<string, { current: number; max: number }>;
    feats: string[];
};

export type NpcWorldStats = {
    givenName: string;
    roleTitle: string;
    level: number;
    archetype: NpcArchetype;
    role: string;
    homeRegion?: string;
    combatReady: boolean;
    mainWeapon: NpcWeaponDef;
    srdBuild: NpcSrdBuild;
    /** PV atuais (pt-BR: vida). */
    vida: number;
    vidaMax: number;
    hp: number;
    maxHp: number;
};

export type BuiltNpcSheet = {
    worldStats: NpcWorldStats;
    sessionSnapshot: Record<string, unknown>;
    initialOverlay: NpcSessionOverlay;
};

const ARCHETYPE_ATTRS: Record<NpcArchetype, NpcSrdBuild['attributes']> = {
    commoner: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    guard: { str: 14, dex: 12, con: 13, int: 10, wis: 11, cha: 10 },
    expert: { str: 12, dex: 10, con: 12, int: 13, wis: 11, cha: 10 },
    scout: { str: 10, dex: 14, con: 11, int: 12, wis: 12, cha: 10 },
    acolyte: { str: 10, dex: 10, con: 11, int: 12, wis: 14, cha: 12 },
    veteran: { str: 15, dex: 12, con: 14, int: 11, wis: 12, cha: 11 },
};

const ARCHETYPE_HIT_DIE: Record<NpcArchetype, number> = {
    commoner: 4,
    guard: 10,
    expert: 8,
    scout: 8,
    acolyte: 8,
    veteran: 10,
};

const ARCHETYPE_AC_BONUS: Record<NpcArchetype, number> = {
    commoner: 0,
    guard: 3,
    expert: 1,
    scout: 1,
    acolyte: 1,
    veteran: 4,
};

const ARCHETYPE_LABEL: Record<NpcArchetype, string> = {
    commoner: 'Plebeu',
    guard: 'Guarda',
    expert: 'Especialista',
    scout: 'Batedor',
    acolyte: 'Acólito',
    veteran: 'Veterano',
};

/** Itens determinísticos do catálogo PENAI (sem inventar slugs novos). */
const WEAPON_BY_ROLE: Array<{ match: RegExp; weapon: NpcWeaponDef }> = [
    {
        match: /ferreir|forj|artes[aã]o|marteleiro|ferreiro/i,
        weapon: {
            itemKey: 'mace',
            name: 'Maça de ferreiro',
            quantity: 1,
            equipped: true,
            itemData: { type: 'weapon', damage: '1d6', damageType: 'bludgeoning', category: 'simple' },
        },
    },
    {
        match: /guard|mil[ií]c|soldad|sentin|porteiro|capit[aã]o/i,
        weapon: {
            itemKey: 'spear',
            name: 'Lança',
            quantity: 1,
            equipped: true,
            itemData: { type: 'weapon', damage: '1d6', damageType: 'piercing', category: 'simple' },
        },
    },
    {
        match: /caçador|ranger|batedor|scout/i,
        weapon: {
            itemKey: 'shortbow',
            name: 'Arco curto',
            quantity: 1,
            equipped: true,
            itemData: { type: 'weapon', damage: '1d6', damageType: 'piercing', category: 'ranged' },
        },
    },
    {
        match: /cl[eé]rigo|sacerdote|ac[oó]lit|templo|f[eé]/i,
        weapon: {
            itemKey: 'mace',
            name: 'Maça sagrada',
            quantity: 1,
            equipped: true,
            itemData: { type: 'weapon', damage: '1d6', damageType: 'bludgeoning', category: 'simple' },
        },
    },
    {
        match: /mercador|com[eé]rcio|vendedor|taverneiro/i,
        weapon: {
            itemKey: 'dagger',
            name: 'Adaga',
            quantity: 1,
            equipped: true,
            itemData: { type: 'weapon', damage: '1d4', damageType: 'piercing', category: 'simple' },
        },
    },
    {
        match: /escriba|informante|erudito|mago|arcan/i,
        weapon: {
            itemKey: 'quarterstaff',
            name: 'Bordão',
            quantity: 1,
            equipped: true,
            itemData: { type: 'weapon', damage: '1d6', damageType: 'bludgeoning', category: 'simple' },
        },
    },
];

const DEFAULT_WEAPON: NpcWeaponDef = {
    itemKey: 'shortsword',
    name: 'Espada curta',
    quantity: 1,
    equipped: true,
    itemData: { type: 'weapon', damage: '1d6', damageType: 'slashing', category: 'martial' },
};

export function proficiencyBonusForLevel(level: number): number {
    return Math.floor((Math.max(1, level) - 1) / 4) + 2;
}

export function npcLevelForTier(heroLevel: number, tier: EntityTier): number {
    const h = Math.max(1, Math.min(20, heroLevel));
    switch (tier) {
        case 'MAJOR':
            return Math.min(20, h + 2);
        case 'SECONDARY':
            return h;
        case 'INCIDENTAL':
            return Math.max(1, h - 2);
        default:
            return h;
    }
}

export function archetypeFromRole(role: string): NpcArchetype {
    const r = role.toLowerCase();
    if (/guard|milíc|soldad|sentin|porteiro|capitão/i.test(r)) return 'guard';
    if (/ferreir|forj|artesão|ferreiro/i.test(r)) return 'expert';
    if (/caçador|batedor|scout|ladino|bandido/i.test(r)) return 'scout';
    if (/clérigo|sacerdote|acólit|templo|fé/i.test(r)) return 'acolyte';
    if (/capitão|veterano|mercenário|guerreiro/i.test(r)) return 'veteran';
    return 'commoner';
}

export function resolveMainWeapon(role: string, tier: EntityTier): NpcWeaponDef {
    const base =
        WEAPON_BY_ROLE.find(w => w.match.test(role))?.weapon ?? { ...DEFAULT_WEAPON };
    if (tier !== 'MAJOR') return { ...base };

    const magicEligible = /guard|veterano|capitão|ferreir|sacerdote|mago/i.test(role);
    if (!magicEligible) return { ...base };

    return {
        ...base,
        itemKey: `${base.itemKey}-plus1`,
        name: `${base.name} +1`,
        itemData: {
            ...base.itemData,
            magical: true,
            bonus: 1,
            rarity: 'uncommon',
        },
    };
}

function abilityMod(score: number): number {
    return Math.floor((score - 10) / 2);
}

function scaleAttributesForLevel(
    base: NpcSrdBuild['attributes'],
    level: number,
): NpcSrdBuild['attributes'] {
    const bumps = Math.floor((Math.max(1, level) - 1) / 4);
    const bumpStat = (v: number, extra: number) => Math.min(20, v + extra);
    return {
        strength: bumpStat(base.strength, bumps),
        dexterity: bumpStat(base.dexterity, Math.max(0, bumps - 1)),
        constitution: bumpStat(base.constitution, bumps),
        intelligence: bumpStat(base.intelligence, Math.max(0, bumps - 1)),
        wisdom: bumpStat(base.wisdom, Math.max(0, bumps - 1)),
        charisma: bumpStat(base.charisma, Math.max(0, bumps - 2)),
    };
}

function toSrdAttributes(attrs: NpcSrdBuild['attributes']): NpcSrdBuild['attributes'] {
    return {
        strength: attrs.strength,
        dexterity: attrs.dexterity,
        constitution: attrs.constitution,
        intelligence: attrs.intelligence,
        wisdom: attrs.wisdom,
        charisma: attrs.charisma,
    };
}

function toAtributosPt(attrs: NpcSrdBuild['attributes']): NpcAtributosPt {
    return {
        forca: attrs.strength,
        destreza: attrs.dexterity,
        constituicao: attrs.constitution,
        inteligencia: attrs.intelligence,
        sabedoria: attrs.wisdom,
        carisma: attrs.charisma,
    };
}

function legacyArchetypeToSrd(attrs: NpcSrdBuild['attributes'] | Record<string, number>): NpcSrdBuild['attributes'] {
    const a = attrs as Record<string, number>;
    return {
        strength: a.strength ?? a.str ?? 10,
        dexterity: a.dexterity ?? a.dex ?? 10,
        constitution: a.constitution ?? a.con ?? 10,
        intelligence: a.intelligence ?? a.int ?? 10,
        wisdom: a.wisdom ?? a.wis ?? 10,
        charisma: a.charisma ?? a.cha ?? 10,
    };
}

export function buildNpcSrdBuild(opts: {
    level: number;
    archetype: NpcArchetype;
    role: string;
}): NpcSrdBuild {
    const level = Math.max(1, Math.min(20, opts.level));
    const baseLegacy = legacyArchetypeToSrd(ARCHETYPE_ATTRS[opts.archetype] as unknown as Record<string, number>);
    const attributes = scaleAttributesForLevel(toSrdAttributes(baseLegacy), level);
    const conMod = abilityMod(attributes.constitution);
    const dexMod = abilityMod(attributes.dexterity);
    const hitDie = ARCHETYPE_HIT_DIE[opts.archetype];
    const maxHp = Math.max(4, hitDie + conMod + (level - 1) * (Math.floor(hitDie / 2) + 1 + conMod));
    const ac = 10 + dexMod + ARCHETYPE_AC_BONUS[opts.archetype];
    const classProfile = classProfileFromRole(opts.role, opts.archetype);
    const spells = classProfile.isSpellcaster
        ? spellsForNpcClass(classProfile.characterClass, level)
        : [];

    return {
        level,
        archetype: opts.archetype,
        role: opts.role,
        race: 'human',
        raceLabel: 'Humano',
        characterClass: classProfile.characterClass,
        characterClassLabel: classProfile.characterClassLabel,
        isSpellcaster: classProfile.isSpellcaster,
        attributes,
        atributos: toAtributosPt(attributes),
        proficiencyBonus: proficiencyBonusForLevel(level),
        ac,
        maxHp,
        hp: maxHp,
        spells,
        spellSlots: classProfile.isSpellcaster
            ? spellSlotsForNpcLevel(level, classProfile.characterClass)
            : {},
        feats: [],
    };
}

export function buildNpcCombatSheet(opts: {
    role: string;
    tier: EntityTier;
    heroLevel: number;
    homeRegion?: string;
    givenName?: string;
    roleTitle?: string;
    displayName?: string;
    suggestedMaxHp?: number;
    /** Ficha gerada pelo Gemini (prioridade sobre templates locais). */
    aiSheet?: NpcAiSheetInput | null;
}): BuiltNpcSheet {
    const level = opts.aiSheet?.level ?? npcLevelForTier(opts.heroLevel, opts.tier);
    const archetype = archetypeFromRole(opts.role);
    const fallbackWeapon = resolveMainWeapon(opts.role, opts.tier);
    const mainWeapon = resolveWeaponFromAiSlug(opts.aiSheet?.mainWeaponSlug, fallbackWeapon);
    let srdBuild = buildNpcSrdBuild({ level, archetype, role: opts.role });
    if (opts.aiSheet) {
        srdBuild = mergeAiSheetIntoSrdBuild(srdBuild, opts.aiSheet, opts.role, archetype);
    }

    let givenName = opts.givenName?.trim() ?? '';
    let roleTitle = opts.roleTitle?.trim() ?? '';
    if (opts.displayName?.trim()) {
        const parsed = parseNpcDisplayName(opts.displayName);
        givenName = givenName || parsed.givenName;
        roleTitle = roleTitle || parsed.roleTitle;
    }
    if (!givenName) givenName = 'Desconhecido';
    if (!roleTitle) roleTitle = opts.role;

    if (typeof opts.suggestedMaxHp === 'number' && opts.suggestedMaxHp >= 4) {
        srdBuild.maxHp = Math.min(400, Math.round(opts.suggestedMaxHp));
        srdBuild.hp = srdBuild.maxHp;
    }

    const worldStats: NpcWorldStats = {
        givenName,
        roleTitle,
        level,
        archetype,
        role: opts.role,
        homeRegion: opts.homeRegion,
        combatReady: opts.tier === 'MAJOR' || opts.tier === 'SECONDARY',
        mainWeapon,
        srdBuild,
        vida: srdBuild.hp,
        vidaMax: srdBuild.maxHp,
        hp: srdBuild.hp,
        maxHp: srdBuild.maxHp,
    };

    const inventory: NpcInventoryEntry[] = [
        {
            itemKey: mainWeapon.itemKey,
            name: mainWeapon.name,
            quantity: mainWeapon.quantity,
            equipped: mainWeapon.equipped,
            itemData: mainWeapon.itemData,
            source: 'bootstrap',
        },
    ];

    if (opts.tier !== 'INCIDENTAL' && /mercador|guard|taverneiro/i.test(opts.role)) {
        inventory.push({
            itemKey: 'healing-potion',
            name: 'Poção de cura',
            quantity: 1,
            itemData: { type: 'consumable', heal: '2d4+2' },
            source: 'bootstrap',
        });
    }

    const displayName = formatNpcDisplayName(givenName, roleTitle);

    return {
        worldStats,
        sessionSnapshot: {
            givenName,
            roleTitle,
            displayName,
            level: srdBuild.level,
            role: opts.role,
            archetype,
            ac: srdBuild.ac,
            maxHp: srdBuild.maxHp,
            hp: srdBuild.hp,
            vida: srdBuild.hp,
            vidaMax: srdBuild.maxHp,
            mainWeapon: mainWeapon.itemKey,
            characterClass: srdBuild.characterClassLabel,
            atributos: srdBuild.atributos,
            isSpellcaster: srdBuild.isSpellcaster,
            spells: srdBuild.spells,
        },
        initialOverlay: {
            inventory,
            hpCurrent: srdBuild.hp,
            attitude: 'neutral',
        },
    };
}

export async function resolveHeroLevelForSession(sessionId: number): Promise<number> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    if (!session?.heroWorldEntityId) return 1;

    const hero = await PenaiDataSource.getRepository(WorldEntity).findOne({
        where: { id: session.heroWorldEntityId },
    });
    const srdBuild = (hero?.stats?.srdBuild ?? {}) as Record<string, unknown>;
    if (typeof srdBuild.level === 'number') return Math.max(1, Math.min(20, srdBuild.level));

    const state = await PenaiDataSource.getRepository(SessionEntityState).findOne({
        where: { sessionId, worldEntityId: session.heroWorldEntityId },
    });
    const snap = state?.sessionStatsSnapshot as Record<string, unknown> | null;
    if (typeof snap?.level === 'number') return Math.max(1, Math.min(20, snap.level));

    return 1;
}

export function buildNpcCombatSheetForDraft(
    draft: BootstrapNpcDraft,
    heroLevel: number,
    homeRegion: string,
): BuiltNpcSheet {
    return buildNpcCombatSheet({
        role: draft.role,
        tier: draft.tier,
        heroLevel,
        homeRegion,
        givenName: draft.givenName,
        roleTitle: draft.roleTitle,
        displayName: draft.displayName,
        suggestedMaxHp: draft.maxHp,
        aiSheet: draft.aiSheet ?? null,
    });
}

export function npcCastFromEntity(entity: WorldEntity): {
    givenName: string;
    roleTitle: string;
    level: number;
    role: string;
    archetype: string;
    characterClass: string;
    ac: number;
    maxHp: number;
    vida: number;
    vidaMax: number;
    mainWeaponName: string;
    atributos: NpcAtributosPt;
    isSpellcaster: boolean;
    spells: string[];
} {
    const stats = entity.stats as NpcWorldStats | Record<string, unknown>;
    const srd = (stats.srdBuild ?? {}) as NpcSrdBuild;
    const main = (stats.mainWeapon ?? {}) as NpcWeaponDef;
    const parsed = parseNpcDisplayName(entity.displayName);
    const vidaMax =
        typeof stats.vidaMax === 'number'
            ? stats.vidaMax
            : typeof stats.maxHp === 'number'
              ? stats.maxHp
              : srd.maxHp ?? 8;
    const vida =
        typeof stats.vida === 'number'
            ? stats.vida
            : typeof stats.hp === 'number'
              ? stats.hp
              : srd.hp ?? vidaMax;
    const attrs =
        srd.atributos ??
        (srd.attributes
            ? toAtributosPt(legacyArchetypeToSrd(srd.attributes as unknown as Record<string, number>))
            : toAtributosPt(legacyArchetypeToSrd({})));

    return {
        givenName: typeof stats.givenName === 'string' ? stats.givenName : parsed.givenName,
        roleTitle: typeof stats.roleTitle === 'string' ? stats.roleTitle : parsed.roleTitle,
        level: typeof stats.level === 'number' ? stats.level : srd.level ?? 1,
        role: typeof stats.role === 'string' ? stats.role : srd.role ?? '',
        archetype: typeof stats.archetype === 'string' ? stats.archetype : srd.archetype ?? 'commoner',
        characterClass: srd.characterClassLabel ?? ARCHETYPE_LABEL[srd.archetype ?? 'commoner'] ?? 'NPC',
        ac: srd.ac ?? 10,
        maxHp: vidaMax,
        vida,
        vidaMax,
        mainWeaponName: main.name ?? '—',
        atributos: attrs,
        isSpellcaster: Boolean(srd.isSpellcaster),
        spells: Array.isArray(srd.spells) ? srd.spells : [],
    };
}
