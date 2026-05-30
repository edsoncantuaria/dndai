import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { loadPenaiHeroPack } from './loadSnapshot.js';
import { listHeroInventory } from './heroInventory.js';
import { getPenaiCombatState } from '../combat/engine.js';
import { parseGameClock, defaultGameClock } from '../world/gameClock.js';
import { loadSessionWorldStateView } from '../world/sessionSnapshot.js';
import { buildContextualActionOptions } from '../motor/contextualActionOptions.js';
import { listSessionCompanions } from '../combat/summonService.js';
import {
    computeCarryingCapacityLb,
    computeInventoryTotalWeightLb,
    resolveItemUnitWeightLb,
} from './inventoryWeight.js';

export async function formatMechanicalPack(sessionId: number): Promise<Record<string, unknown>> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    const pack = await loadPenaiHeroPack(sessionId);
    const combatState = await getPenaiCombatState(sessionId);
    const companions = await listSessionCompanions(sessionId);
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

    const progression = pack
        ? await (
              await import('./progressionPack.js')
          ).loadPenaiProgressionPack({
              sessionId,
              heroEntityId: pack.heroEntityId,
              srdBuild,
          })
        : null;
    const buildAttrs = (srdBuild.attributes ?? {}) as Record<string, number>;
    const abilities = pack?.snapshot.abilities ?? {};
    const attr = (key: string, fallback: number) =>
        typeof buildAttrs[key] === 'number'
            ? buildAttrs[key]
            : typeof (abilities as Record<string, number>)[key] === 'number'
              ? (abilities as Record<string, number>)[key]
              : fallback;
    const strength = attr('strength', 10);
    const dexterity = attr('dexterity', 10);
    const constitution = attr('constitution', 10);
    const intelligence = attr('intelligence', 10);
    const wisdom = attr('wisdom', 10);
    const charisma = attr('charisma', 10);
    const mod = (score: number) => Math.floor((score - 10) / 2);

    const currentWeight = pack
        ? await computeInventoryTotalWeightLb(inventory, pack.stats.coins)
        : 0;
    const carryingCapacity = computeCarryingCapacityLb(strength);

    const inventoryWithWeight = await Promise.all(
        inventory.map(async i => {
            const unitWeightLb = await resolveItemUnitWeightLb(i);
            const qty = Math.max(1, i.quantity);
            return {
                id: i.id,
                index: i.itemKey,
                name: i.name,
                quantity: i.quantity,
                equipped: i.equipped,
                weight: unitWeightLb,
                lineWeightLb: Math.round(unitWeightLb * qty * 100) / 100,
                itemData: i.itemData,
            };
        }),
    );

    return {
        sessionId,
        stateVersion: session?.stateVersion ?? 0,
        currentRegionSlug: session?.currentRegionSlug ?? null,
        intentType: 'snapshot',
        worldState,
        gameClock,
        progressionFeed: progression?.progressionFeed ?? [],
        character: pack
            ? {
                  id: pack.heroEntityId,
                  name: pack.snapshot.name,
                  level: progression?.level ?? pack.snapshot.level,
                  xp: progression?.xp ?? 0,
                  xpToNextLevel: progression?.xpToNextLevel ?? 300,
                  classLevelsData: progression?.classLevelsData ?? [],
                  subclassLevelsData: progression?.subclassLevelsData ?? [],
                  hp: pack.stats.hp,
                  maxHp: pack.stats.maxHp,
                  ac: pack.stats.ac,
                  coins: pack.stats.coins,
                  resources: pack.stats.resources,
                  conditions: pack.stats.conditions,
                  classIndex: srdBuild.characterClass ?? srdBuild.class ?? null,
                  raceIndex: srdBuild.race ?? null,
                  subraceIndex: srdBuild.subrace ?? null,
                  race: String(srdBuild.raceLabel ?? srdBuild.race ?? ''),
                  subrace: srdBuild.subrace ? String(srdBuild.subraceLabel ?? srdBuild.subrace) : null,
                  characterClass: String(
                      srdBuild.characterClassLabel ?? srdBuild.characterClass ?? srdBuild.class ?? '',
                  ),
                  background: String(srdBuild.background ?? ''),
                  attributes: {
                      strength,
                      dexterity,
                      constitution,
                      intelligence,
                      wisdom,
                      charisma,
                  },
                  modifiers: {
                      strength: mod(strength),
                      dexterity: mod(dexterity),
                      constitution: mod(constitution),
                      intelligence: mod(intelligence),
                      wisdom: mod(wisdom),
                      charisma: mod(charisma),
                  },
                  spellSlots:
                      (srdBuild.spellSlots as Record<string, { current: number; max: number }>) ?? {},
                  feats: Array.isArray(srdBuild.feats) ? srdBuild.feats : [],
                  spells: Array.isArray(srdBuild.spells) ? srdBuild.spells : [],
                  skillProficiencies: pack.snapshot.skillProficiencies ?? [],
                  inventory: inventoryWithWeight,
                  currentWeight,
                  carryingCapacity,
              }
            : null,
        shopState: session?.motorShopState ?? null,
        pendingLootOffer: session?.pendingLootOffer ?? null,
        combatState,
        companions,
        actionOptions:
            Array.isArray(session?.lastActionOptions) && session.lastActionOptions.length > 0
                ? session.lastActionOptions
                : buildContextualActionOptions({
                      domain: combatState.isActive ? 'combat' : 'exploration',
                      combatActive: combatState.isActive,
                      proficientSkills: pack?.snapshot.skillProficiencies,
                      knownSpells: Array.isArray(srdBuild.spells)
                          ? (srdBuild.spells as string[])
                          : [],
                      shopOpen: Boolean(session?.motorShopState),
                      lootPending: Boolean(session?.pendingLootOffer),
                  }),
    };
}
