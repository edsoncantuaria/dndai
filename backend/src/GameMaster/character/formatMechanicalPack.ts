import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { loadPenaiHeroPack } from './loadPenaiCharacterSnapshot.js';
import { listHeroInventory } from './heroInventory.js';
import { getPenaiCombatState } from '../combat/combatPenai.js';
import { parseGameClock, defaultGameClock } from '../world/gameClockPenai.js';
import { buildContextualActionOptions } from '../motor/contextualActionOptions.js';

export async function formatMechanicalPack(sessionId: number): Promise<Record<string, unknown>> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    const pack = await loadPenaiHeroPack(sessionId);
    const combatState = await getPenaiCombatState(sessionId);
    const worldState = await loadSessionWorldStateView(sessionId);
    const gameClock = session
        ? parseGameClock(session.gameClock as Record<string, unknown> | null)
        : defaultGameClock();

    const inventory = pack
        ? await listHeroInventory(sessionId, pack.heroEntityId)
        : [];

    const heroEntity = pack
        ? await PenaiDataSource.getRepository(
              (await import('../database/entities/WorldEntity.js')).WorldEntity,
          ).findOne({ where: { id: pack.heroEntityId } })
        : null;
    const srdBuild = ((heroEntity?.stats?.srdBuild ?? {}) as Record<string, unknown>) || {};

    return {
        sessionId,
        stateVersion: session?.stateVersion ?? 0,
        currentRegionSlug: session?.currentRegionSlug ?? null,
        intentType: 'snapshot',
        worldState,
        gameClock,
        character: pack
            ? {
                  id: pack.heroEntityId,
                  name: pack.snapshot.name,
                  level: pack.snapshot.level,
                  hp: pack.stats.hp,
                  maxHp: pack.stats.maxHp,
                  ac: pack.stats.ac,
                  coins: pack.stats.coins,
                  resources: pack.stats.resources,
                  conditions: pack.stats.conditions,
                  classIndex: srdBuild.characterClass ?? srdBuild.class ?? null,
                  feats: Array.isArray(srdBuild.feats) ? srdBuild.feats : [],
                  spells: Array.isArray(srdBuild.spells) ? srdBuild.spells : [],
                  skillProficiencies: pack.snapshot.skillProficiencies ?? [],
                  inventory: inventory.map(i => ({
                      id: i.id,
                      index: i.itemKey,
                      name: i.name,
                      quantity: i.quantity,
                      equipped: i.equipped,
                      itemData: i.itemData,
                  })),
              }
            : null,
        shopState: session?.motorShopState ?? null,
        pendingLootOffer: session?.pendingLootOffer ?? null,
        combatState,
        actionOptions: buildContextualActionOptions({
            domain: combatState.isActive ? 'combat' : 'exploration',
            combatActive: combatState.isActive,
            proficientSkills: pack?.snapshot.skillProficiencies,
            knownSpells: Array.isArray(srdBuild.spells) ? (srdBuild.spells as string[]) : [],
            shopOpen: Boolean(session?.motorShopState),
            lootPending: Boolean(session?.pendingLootOffer),
        }),
    };
}
