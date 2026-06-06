import type { Character, CharacterSpell, InventoryItem, ProgressionFeedItem, SessaoIA } from '@/types';
import { markSessionAsPenai } from '@/lib/penaiEngine';
import { calculateWeight, getXpThreshold } from '@/utils/characterUtils';
import { COIN_WEIGHT } from '@/utils/currency';
import type { ApiClassLevel } from '@/types';
import {
    createPenaiSession,
    fetchPenaiMechanical,
    fetchPenaiSession,
    fetchPenaiSessions,
} from '@/services/penaiApi';

type MechanicalPack = Record<string, unknown>;

function asRecord(v: unknown): Record<string, unknown> | null {
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
}

function abilityMod(score: number): number {
    return Math.floor((score - 10) / 2);
}

function normalizeSpells(raw: unknown): CharacterSpell[] | string[] {
    if (!Array.isArray(raw)) return [];
    return raw.map(entry => {
        if (typeof entry === 'string') return entry;
        if (entry && typeof entry === 'object') {
            const o = entry as Record<string, unknown>;
            const index = String(o.spellName ?? o.index ?? o.name ?? '');
            return {
                id: Number(o.id ?? 0),
                characterId: 0,
                spellName: index,
                level: Number(o.level ?? 0),
                prepared: Boolean(o.prepared ?? true),
            } satisfies CharacterSpell;
        }
        return String(entry);
    });
}

/** Converte mechanical pack PENAI → Character para UI existente. */
export function mechanicalPackToCharacter(
    sessionId: number,
    userId: number,
    pack: MechanicalPack,
    sessionMeta?: Record<string, unknown>,
): Character {
    const ch = asRecord(pack.character);
    const heroId = String(ch?.id ?? sessionId);
    const numericId = sessionId;
    const hp = Number(ch?.hp ?? 10);
    const maxHp = Number(ch?.maxHp ?? hp);
    const ac = Number(ch?.ac ?? 12);
    const level = Number(ch?.level ?? 1);
    const xp = Number(ch?.xp ?? 0);
    const xpToNextLevel = Number(ch?.xpToNextLevel ?? getXpThreshold(level));
    const name = String(ch?.name ?? sessionMeta?.nome ?? 'Herói');
    const coins = asRecord(ch?.coins) ?? {};
    const attrs = asRecord(ch?.attributes) ?? {};
    const mods = asRecord(ch?.modifiers) ?? {};

    const strength = Number(attrs.strength ?? 10);
    const dexterity = Number(attrs.dexterity ?? 10);
    const constitution = Number(attrs.constitution ?? 10);
    const intelligence = Number(attrs.intelligence ?? 10);
    const wisdom = Number(attrs.wisdom ?? 10);
    const charisma = Number(attrs.charisma ?? 10);

    const inventory: InventoryItem[] = Array.isArray(ch?.inventory)
        ? (ch!.inventory as Array<Record<string, unknown>>).map((item, idx) => {
              const itemData = (item.itemData as Record<string, unknown>) ?? {};
              const unitFromPack =
                  typeof item.weight === 'number'
                      ? item.weight
                      : typeof itemData.unitWeightLb === 'number'
                        ? itemData.unitWeightLb
                        : undefined;
              return {
                  id: String(item.id ?? item.index ?? idx),
                  index: String(item.index ?? item.itemKey ?? idx),
                  name: String(item.name ?? 'Item'),
                  quantity: Number(item.quantity ?? 1),
                  equipped: Boolean(item.equipped),
                  weight: unitFromPack,
                  itemData,
              };
          })
        : [];

    const currencyFromCoins = {
        pp: Number(coins.pp ?? 0),
        gp: Number(coins.gp ?? 0),
        ep: Number(coins.ep ?? 0),
        sp: Number(coins.sp ?? 0),
        cp: Number(coins.cp ?? 0),
    };
    const coinCount = Object.values(currencyFromCoins).reduce((s, n) => s + n, 0);
    const coinWeight = coinCount * COIN_WEIGHT;
    const inventoryWeight = calculateWeight(inventory);
    const computedWeight = Math.round((inventoryWeight + coinWeight) * 100) / 100;
    const packWeight = Number(ch?.currentWeight);
    const currentWeight = Number.isFinite(packWeight) ? packWeight : computedWeight;
    const packCapacity = Number(ch?.carryingCapacity);
    const carryingCapacity = Number.isFinite(packCapacity)
        ? packCapacity
        : Math.max(150, strength * 15);

    const spells = normalizeSpells(ch?.spells);
    const spellSlots =
        (ch?.spellSlots as Record<string, { current: number; max: number }>) ?? {};

    const race = String(ch?.race ?? 'Humano').trim() || 'Humano';
    const subraceRaw = ch?.subrace;
    const subrace = subraceRaw != null && String(subraceRaw).trim() ? String(subraceRaw) : null;
    const characterClass = String(ch?.characterClass ?? 'Aventureiro').trim() || 'Aventureiro';
    const background = String(ch?.background ?? 'PENAI').trim() || 'PENAI';

    const proficiencyBonus = Math.max(2, Math.floor((level - 1) / 4) + 2);

    const now = new Date().toISOString();
    const ws = asRecord(pack.worldState);
    const regionLabel =
        String(ws?.currentRegion ?? ws?.location ?? pack.currentRegionSlug ?? 'Região desconhecida');

    return {
        id: numericId,
        userId,
        name,
        race,
        subrace,
        characterClass,
        level,
        background,
        alignment: 'Neutro',
        backstory: '',
        ideal: '',
        bond: '',
        flaw: '',
        sex: '',
        hairStyle: '',
        beardStyle: '',
        skinColor: '',
        attributes: {
            id: numericId,
            characterId: numericId,
            strength,
            dexterity,
            constitution,
            intelligence,
            wisdom,
            charisma,
            hp,
            maxHp,
            ac,
            conditions: [],
        },
        proficiencies: [],
        inventory,
        spells,
        journal: [],
        relationships: [],
        personalityTraits: [],
        modifiers: {
            strength: Number(mods.strength ?? abilityMod(strength)),
            dexterity: Number(mods.dexterity ?? abilityMod(dexterity)),
            constitution: Number(mods.constitution ?? abilityMod(constitution)),
            intelligence: Number(mods.intelligence ?? abilityMod(intelligence)),
            wisdom: Number(mods.wisdom ?? abilityMod(wisdom)),
            charisma: Number(mods.charisma ?? abilityMod(charisma)),
        },
        proficiencyBonus,
        hp: { current: hp, max: maxHp, temp: 0 },
        ac: { value: ac, source: 'penai' },
        xp,
        xpToNextLevel: Number.isFinite(xpToNextLevel) ? xpToNextLevel : getXpThreshold(level),
        hitDie: 10,
        hitDice: { current: 1, total: 1 },
        speed: 30,
        deathSaves: {
            successes: Number((ch?.deathSaves as { successes?: number })?.successes ?? 0),
            failures: Number((ch?.deathSaves as { failures?: number })?.failures ?? 0),
        },
        conditions: Array.isArray(ch?.conditions) ? (ch!.conditions as Character['conditions']) : [],
        currency: currencyFromCoins,
        currentWeight,
        carryingCapacity,
        spellSlots,
        classLevelsData: Array.isArray(ch?.classLevelsData)
            ? (ch!.classLevelsData as ApiClassLevel[])
            : [],
        subclassLevelsData: Array.isArray(ch?.subclassLevelsData)
            ? (ch!.subclassLevelsData as ApiClassLevel[])
            : [],
        traits: [],
        feats: Array.isArray(ch?.feats) ? (ch!.feats as Character['feats']) : [],
        languages: ['Comum'],
        subclassFlavor: null,
        currentRegion: regionLabel,
        sessionId,
        createdAt: now,
        updatedAt: now,
        worldState: {
            timeOfDay: String(ws?.timeOfDay ?? 'Manhã'),
            weather: String(ws?.weather ?? 'clear'),
            climate: String(ws?.weather ?? 'clear'),
            currentRegion: regionLabel,
            location: regionLabel,
            regionSlug: String(pack.currentRegionSlug ?? ''),
            gameClock: asRecord(pack.gameClock) ?? { day: 1, hour: 8, weather: 'clear' },
            penaiHeroEntityId: heroId,
            engine: 'penai',
        },
    };
}

export function penaiSessionToSessaoIA(row: Record<string, unknown>, heroName?: string): SessaoIA {
    const now = new Date().toISOString();
    const name = heroName ?? (typeof row.heroName === 'string' ? row.heroName : undefined);
    const race = typeof row.heroRace === 'string' ? row.heroRace : 'Humano';
    const characterClass = typeof row.heroClass === 'string' ? row.heroClass : 'Aventureiro';
    return {
        id: Number(row.id),
        nome: String(row.nome ?? 'Sessão'),
        userId: Number(row.userId ?? 1),
        characterId: null,
        stateVersion: Number(row.stateVersion ?? 0),
        character: name
            ? {
                  id: Number(row.id),
                  name,
                  level: 1,
                  characterClass,
                  subclassFlavor: '',
                  race,
              }
            : undefined,
        createdAt: String(row.createdAt ?? now),
        updatedAt: String(row.updatedAt ?? now),
        homebrewContentIds: [],
    };
}

function mergeProgressionFeedFromPack(
    pack: MechanicalPack,
): ProgressionFeedItem[] {
    const raw = pack.progressionFeed;
    if (!Array.isArray(raw)) return [];
    return raw.map((entry, idx) => {
        const e = entry as Record<string, unknown>;
        return {
            id: `penai-${idx}-${String(e.type ?? 'xp')}`,
            type: (e.type === 'level_up' ? 'level_up' : 'xp_gain') as ProgressionFeedItem['type'],
            summary: String(e.summary ?? ''),
            source: typeof e.source === 'string' ? e.source : undefined,
            detail: typeof e.detail === 'string' ? e.detail : undefined,
            xp: typeof e.xp === 'number' ? e.xp : undefined,
            level: typeof e.level === 'number' ? e.level : undefined,
            timestamp: new Date().toISOString(),
        };
    });
}

export async function loadPenaiGameSession(sessionId: number, userId: number) {
    const [session, mechanical] = await Promise.all([
        fetchPenaiSession(sessionId),
        fetchPenaiMechanical(sessionId),
    ]);
    markSessionAsPenai(sessionId);
    const character = mechanicalPackToCharacter(sessionId, userId, mechanical, session);
    const progressionFeed = mergeProgressionFeedFromPack(mechanical);
    return { session, mechanical, character, progressionFeed };
}

export async function createAndLoadPenaiSession(
    nome: string,
    heroRef: { name: string; id?: string | number },
    userId: number,
) {
    const heroWorldEntityId =
        typeof heroRef.id === 'string' && heroRef.id.includes('-') ? heroRef.id : undefined;
    const created = await createPenaiSession(nome, {
        heroName: heroRef.name,
        heroWorldEntityId,
    });
    const sessionId = Number(created.id);
    if (!Number.isFinite(sessionId)) {
        throw new Error('Sessão PENAI criada sem id válido.');
    }
    return loadPenaiGameSession(sessionId, userId);
}

export { fetchPenaiSessions };
