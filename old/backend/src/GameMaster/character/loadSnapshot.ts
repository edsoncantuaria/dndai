import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { WorldEntity } from '../database/entities/WorldEntity.js';
import type { Ability, RulesCharacterSnapshot } from '../../rules/types.js';
import { computeProficiencyBonus } from '../../rules/utils.js';
import { ensureHeroSessionState, loadHeroSessionStats, parseHeroSessionStats } from './heroStats.js';
import { listHeroInventory } from './heroInventory.js';

const DEFAULT_ABILITIES: Record<Ability, number> = {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
};

export async function loadPenaiCharacterSnapshot(
    sessionId: number,
): Promise<RulesCharacterSnapshot | null> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    if (!session?.heroWorldEntityId) return null;

    const hero = await PenaiDataSource.getRepository(WorldEntity).findOne({
        where: { id: session.heroWorldEntityId },
    });
    if (!hero) return null;

    await ensureHeroSessionState(sessionId, hero.id);
    const heroStats = await loadHeroSessionStats(sessionId, hero.id);
    const stateRow = await PenaiDataSource.getRepository(
        (await import('../database/entities/SessionEntityState.js')).SessionEntityState,
    ).findOne({ where: { sessionId, worldEntityId: hero.id } });
    const sessionSnap = (stateRow?.sessionStatsSnapshot ?? {}) as Record<string, unknown>;
    const items = await listHeroInventory(sessionId, hero.id);

    const stats = hero.stats ?? {};
    const srdBuild = (stats.srdBuild ?? {}) as Record<string, unknown>;
    const buildAttrs = (srdBuild.attributes ?? {}) as Record<string, unknown>;

    const abilities: Record<Ability, number> = { ...DEFAULT_ABILITIES };
    for (const key of Object.keys(DEFAULT_ABILITIES) as Ability[]) {
        const fromBuild = buildAttrs[key];
        const fromStats = stats[key];
        if (typeof fromBuild === 'number') abilities[key] = fromBuild;
        else if (typeof fromStats === 'number') abilities[key] = fromStats;
    }

    const vaultLevel =
        typeof srdBuild.level === 'number'
            ? srdBuild.level
            : typeof stats.level === 'number'
              ? stats.level
              : 1;
    const sessionLevel = typeof sessionSnap.level === 'number' ? sessionSnap.level : vaultLevel;
    const level = Math.max(vaultLevel, sessionLevel);

    const skillFromBuild = srdBuild.skillProficiencies ?? srdBuild.skills;
    const skillProficiencies = Array.isArray(skillFromBuild)
        ? (skillFromBuild as string[])
        : Array.isArray(stats.skillProficiencies)
          ? (stats.skillProficiencies as string[])
          : [];

    const weaponFromBuild = srdBuild.weaponProficiencies ?? srdBuild.weapons;
    const weaponProficiencies = Array.isArray(weaponFromBuild)
        ? (weaponFromBuild as string[])
        : Array.isArray(stats.weaponProficiencies)
          ? (stats.weaponProficiencies as string[])
          : ['shortsword'];

    const spellcasting =
        (srdBuild.spellcasting as RulesCharacterSnapshot['spellcasting']) ??
        (stats.spellcasting as RulesCharacterSnapshot['spellcasting']);

    return {
        id: hero.id,
        name: hero.displayName,
        level,
        proficiencyBonus: computeProficiencyBonus(level),
        abilities,
        weaponProficiencies,
        skillProficiencies,
        conditions: heroStats.conditions,
        inventory: items.map(i => ({
            index: i.itemKey,
            name: i.name,
            equipped: i.equipped,
            quantity: i.quantity,
        })),
        resources: heroStats.resources,
        spellcasting,
    };
}

/** Snapshot enriquecido para UI / mechanical pack (inclui HP e moedas). */
export async function loadPenaiHeroPack(sessionId: number): Promise<{
    snapshot: RulesCharacterSnapshot;
    heroEntityId: string;
    stats: ReturnType<typeof parseHeroSessionStats>;
} | null> {
    const snapshot = await loadPenaiCharacterSnapshot(sessionId);
    if (!snapshot) return null;
    const heroEntityId = snapshot.id;
    const stats = await loadHeroSessionStats(sessionId, heroEntityId);
    return { snapshot, heroEntityId, stats };
}
