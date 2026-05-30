import type { Character, InventoryItem, SessaoIA } from '@/types';
import { markSessionAsPenai } from '@/lib/penaiEngine';
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
    const name = String(ch?.name ?? sessionMeta?.nome ?? 'Herói');
    const coins = asRecord(ch?.coins) ?? {};

    const inventory: InventoryItem[] = Array.isArray(ch?.inventory)
        ? (ch!.inventory as Array<Record<string, unknown>>).map((item, idx) => ({
              id: String(item.id ?? item.index ?? idx),
              index: String(item.index ?? item.itemKey ?? idx),
              name: String(item.name ?? 'Item'),
              quantity: Number(item.quantity ?? 1),
              equipped: Boolean(item.equipped),
              itemData: (item.itemData as Record<string, unknown>) ?? {},
          }))
        : [];

    const now = new Date().toISOString();
    const ws = asRecord(pack.worldState);
    const regionLabel =
        String(ws?.currentRegion ?? ws?.location ?? pack.currentRegionSlug ?? 'Região desconhecida');

    return {
        id: numericId,
        userId,
        name,
        race: 'Humano',
        subrace: null,
        characterClass: 'Aventureiro',
        level,
        background: 'PENAI',
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
            strength: 14,
            dexterity: 12,
            constitution: 14,
            intelligence: 10,
            wisdom: 10,
            charisma: 10,
            hp,
            maxHp,
            ac,
            conditions: [],
        },
        proficiencies: [],
        inventory,
        spells: [],
        journal: [],
        relationships: [],
        personalityTraits: [],
        modifiers: {
            strength: 2,
            dexterity: 1,
            constitution: 2,
            intelligence: 0,
            wisdom: 0,
            charisma: 0,
        },
        proficiencyBonus: 2,
        hp: { current: hp, max: maxHp, temp: 0 },
        ac: { value: ac, source: 'penai' },
        xp: 0,
        xpToNextLevel: 300,
        hitDie: 10,
        hitDice: { current: 1, total: 1 },
        speed: 30,
        deathSaves: { successes: 0, failures: 0 },
        conditions: [],
        currency: {
            pp: Number(coins.pp ?? 0),
            gp: Number(coins.gp ?? 0),
            ep: Number(coins.ep ?? 0),
            sp: Number(coins.sp ?? 0),
            cp: Number(coins.cp ?? 0),
        },
        currentWeight: 0,
        carryingCapacity: 150,
        spellSlots: {},
        classLevelsData: [],
        traits: [],
        feats: [],
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
    return {
        id: Number(row.id),
        nome: String(row.nome ?? 'Sessão'),
        userId: Number(row.userId ?? 1),
        characterId: null,
        stateVersion: Number(row.stateVersion ?? 0),
        character: heroName
            ? {
                  id: Number(row.id),
                  name: heroName,
                  level: 1,
                  characterClass: 'Aventureiro',
                  subclassFlavor: '',
                  race: 'Humano',
              }
            : undefined,
        createdAt: String(row.createdAt ?? now),
        updatedAt: String(row.updatedAt ?? now),
        homebrewContentIds: [],
    };
}

export async function loadPenaiGameSession(sessionId: number, userId: number) {
    const [session, mechanical] = await Promise.all([
        fetchPenaiSession(sessionId),
        fetchPenaiMechanical(sessionId),
    ]);
    markSessionAsPenai(sessionId);
    const character = mechanicalPackToCharacter(sessionId, userId, mechanical, session);
    return { session, mechanical, character };
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
