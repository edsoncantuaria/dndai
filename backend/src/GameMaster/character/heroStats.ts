import { mergeSpellSlotsIntoResources } from './spellSlotSeedPenai.js';
import { PenaiDataSource } from '../database/data-source.js';
import { WorldEntity } from '../database/entities/WorldEntity.js';
import { GameSession } from '../database/entities/GameSession.js';
import { SessionEntityState } from '../database/entities/SessionEntityState.js';
import type { CharacterResourceSnapshot } from '../../rules/types.js';

export type PenaiCoinPurse = { pp: number; gp: number; ep: number; sp: number; cp: number };

export type HeroSessionStats = {
    hp: number;
    maxHp: number;
    ac: number;
    coins: PenaiCoinPurse;
    resources: CharacterResourceSnapshot[];
    conditions: string[];
};

const DEFAULT_COINS: PenaiCoinPurse = { pp: 0, gp: 15, ep: 0, sp: 0, cp: 0 };

export function defaultHeroSessionStats(level = 1): HeroSessionStats {
    const maxHp = 8 + level;
    return {
        hp: maxHp,
        maxHp,
        ac: 12,
        coins: { ...DEFAULT_COINS },
        resources: [
            {
                type: 'class-resource',
                key: 'action-surge',
                current: 1,
                max: 1,
                refresh: 'short-rest',
            },
        ],
        conditions: [],
    };
}

export async function ensureHeroSessionState(
    sessionId: number,
    heroEntityId: string,
): Promise<SessionEntityState> {
    const repo = PenaiDataSource.getRepository(SessionEntityState);
    let row = await repo.findOne({ where: { sessionId, worldEntityId: heroEntityId } });
    if (!row) {
        row = repo.create({
            sessionId,
            worldEntityId: heroEntityId,
            appeared: true,
            sessionAlive: true,
            canAppear: true,
            relationshipToHero: {},
            sessionStatsSnapshot: defaultHeroSessionStats(),
            lastSeenAt: new Date(),
        });
        await repo.save(row);
    } else if (!row.sessionStatsSnapshot || Object.keys(row.sessionStatsSnapshot).length === 0) {
        row.sessionStatsSnapshot = defaultHeroSessionStats();
        await repo.save(row);
    }

    const hero = await PenaiDataSource.getRepository(WorldEntity).findOne({
        where: { id: heroEntityId },
    });
    const srdBuild = (hero?.stats?.srdBuild ?? {}) as Record<string, unknown>;
    const classIndex = String(srdBuild.characterClass ?? srdBuild.class ?? '');
    const level =
        typeof srdBuild.level === 'number'
            ? srdBuild.level
            : typeof (row.sessionStatsSnapshot as Record<string, unknown>)?.level === 'number'
              ? Number((row.sessionStatsSnapshot as Record<string, unknown>).level)
              : 1;
    if (classIndex) {
        const parsed = parseHeroSessionStats(row.sessionStatsSnapshot);
        const merged = await mergeSpellSlotsIntoResources(parsed.resources, classIndex, level);
        if (merged.length !== parsed.resources.length) {
            row.sessionStatsSnapshot = { ...parsed, resources: merged };
            await repo.save(row);
        }
    }
    return row;
}

export function parseHeroSessionStats(raw: Record<string, unknown> | null): HeroSessionStats {
    const base = defaultHeroSessionStats();
    if (!raw) return base;
    const coins = (raw.coins as Partial<PenaiCoinPurse>) ?? {};
    return {
        hp: typeof raw.hp === 'number' ? raw.hp : base.hp,
        maxHp: typeof raw.maxHp === 'number' ? raw.maxHp : base.maxHp,
        ac: typeof raw.ac === 'number' ? raw.ac : base.ac,
        coins: {
            pp: Number(coins.pp ?? base.coins.pp),
            gp: Number(coins.gp ?? base.coins.gp),
            ep: Number(coins.ep ?? base.coins.ep),
            sp: Number(coins.sp ?? base.coins.sp),
            cp: Number(coins.cp ?? base.coins.cp),
        },
        resources: Array.isArray(raw.resources)
            ? (raw.resources as CharacterResourceSnapshot[])
            : base.resources,
        conditions: Array.isArray(raw.conditions) ? (raw.conditions as string[]) : base.conditions,
    };
}

export async function loadHeroSessionStats(
    sessionId: number,
    heroEntityId: string,
): Promise<HeroSessionStats> {
    const row = await ensureHeroSessionState(sessionId, heroEntityId);
    return parseHeroSessionStats(row.sessionStatsSnapshot);
}

export async function saveHeroSessionStats(
    sessionId: number,
    heroEntityId: string,
    stats: HeroSessionStats,
): Promise<void> {
    const repo = PenaiDataSource.getRepository(SessionEntityState);
    const row = await ensureHeroSessionState(sessionId, heroEntityId);
    row.sessionStatsSnapshot = stats as unknown as Record<string, unknown>;
    await repo.save(row);
}

export async function getSessionHeroEntityId(sessionId: number): Promise<string | null> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    return session?.heroWorldEntityId ?? null;
}
