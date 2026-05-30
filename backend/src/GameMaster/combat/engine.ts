import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { SessionCombatEncounter } from '../database/entities/SessionCombatEncounter.js';
import { SessionCombatant } from '../database/entities/SessionCombatant.js';
import { WorldEntity } from '../database/entities/WorldEntity.js';
import type { EntityStateDelta } from '../../rules/types.js';
import {
    normalizePenaiCombatPhase,
    setPenaiCombatPhase,
    advancePenaiCombatTurn,
} from './phaseGate.js';
import { syncHeroHpPenai, syncHeroHpToCanonical } from '../character/syncHeroHp.js';
import {
    buildCombatVictoryLootPenai,
    persistPendingLootOfferPenai,
} from '../loot/lootService.js';

export type PenaiCombatState = {
    isActive: boolean;
    encounterId: number | null;
    round: number;
    turn: number;
    phase: string;
    initiativeOrder: string[];
    currentEntityKey: string | null;
    combatants: Array<{
        entityKey: string;
        displayName: string;
        side: string;
        hp: number;
        hpMax: number;
        armorClass: number;
        initiative: number;
    }>;
};

function rollD20(): number {
    return Math.floor(Math.random() * 20) + 1;
}

function dexModFromStats(stats: Record<string, unknown>): number {
    const dex = typeof stats.dexterity === 'number' ? stats.dexterity : 10;
    return Math.floor((dex - 10) / 2);
}

async function rollInitiativeForEntity(
    entityKey: string,
    side: SessionCombatant['side'],
): Promise<number> {
    const entity = await PenaiDataSource.getRepository(WorldEntity).findOne({
        where: { id: entityKey },
    });
    const mod = entity ? dexModFromStats(entity.stats ?? {}) : side === 'hero' ? 1 : 0;
    return rollD20() + mod;
}

export async function getPenaiCombatState(sessionId: number): Promise<PenaiCombatState> {
    const sessionRepo = PenaiDataSource.getRepository(GameSession);
    const session = await sessionRepo.findOne({ where: { id: sessionId } });
    if (!session?.activeCombatEncounterId) {
        return {
            isActive: false,
            encounterId: null,
            round: 0,
            turn: 0,
            phase: 'IDLE',
            initiativeOrder: [],
            currentEntityKey: null,
            combatants: [],
        };
    }

    const enc = await PenaiDataSource.getRepository(SessionCombatEncounter).findOne({
        where: { id: session.activeCombatEncounterId },
        relations: ['combatants'],
    });
    if (!enc || !enc.isActive) {
        return {
            isActive: false,
            encounterId: null,
            round: 0,
            turn: 0,
            phase: 'IDLE',
            initiativeOrder: [],
            currentEntityKey: null,
            combatants: [],
        };
    }

    const order = enc.initiativeOrder ?? [];
    const currentEntityKey = order[enc.turn] ?? null;

    return {
        isActive: true,
        encounterId: enc.id,
        round: enc.round,
        turn: enc.turn,
        phase: normalizePenaiCombatPhase(enc.phase),
        initiativeOrder: order,
        currentEntityKey,
        combatants: (enc.combatants ?? []).map(c => ({
            entityKey: c.entityKey,
            displayName: c.displayName,
            side: c.side,
            hp: c.hpCurrent,
            hpMax: c.hpMax,
            armorClass: c.armorClass,
            initiative: c.initiative ?? 0,
        })),
    };
}

export async function applyCombatEntityDeltaPenai(
    sessionId: number,
    delta: EntityStateDelta,
): Promise<void> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    const encounterId = delta.encounterId || session?.activeCombatEncounterId;
    if (!encounterId) return;

    const repo = PenaiDataSource.getRepository(SessionCombatant);
    const combatant = await repo.findOne({
        where: { encounterId, entityKey: delta.entityId },
    });
    if (!combatant) return;

    if (delta.delta.hp) {
        if (typeof delta.delta.hp.setTo === 'number') {
            combatant.hpCurrent = delta.delta.hp.setTo;
        }
        if (typeof delta.delta.hp.delta === 'number') {
            combatant.hpCurrent = Math.max(
                0,
                Math.min(combatant.hpMax, combatant.hpCurrent + delta.delta.hp.delta),
            );
        }
    }
    if (delta.delta.activeConditions) {
        combatant.conditions = delta.delta.activeConditions;
    }
    await repo.save(combatant);

    if (combatant.side === 'hero') {
        await syncHeroHpToCanonical(sessionId, combatant.hpCurrent);
    }

    const enemies = await repo.find({ where: { encounterId, side: 'enemy' } });
    const anyEnemyAlive = enemies.some(e => e.hpCurrent > 0);
    if (enemies.length > 0 && !anyEnemyAlive) {
        const enc = await PenaiDataSource.getRepository(SessionCombatEncounter).findOne({
            where: { id: encounterId },
        });
        const loot = buildCombatVictoryLootPenai({
            hostileCount: enemies.length,
            round: enc?.round ?? 1,
        });
        await persistPendingLootOfferPenai(sessionId, loot);
        const { emitCampaignCombatVictory } = await import('./campaignHooks.js');
        await emitCampaignCombatVictory(sessionId, encounterId);
        await endPenaiCombat(sessionId, encounterId, 'victory');
    }
}

export async function endPenaiCombat(
    sessionId: number,
    encounterId: number,
    _reason: string,
): Promise<void> {
    const encRepo = PenaiDataSource.getRepository(SessionCombatEncounter);
    const sessionRepo = PenaiDataSource.getRepository(GameSession);
    const enc = await encRepo.findOne({ where: { id: encounterId } });
    if (enc) {
        enc.isActive = false;
        await setPenaiCombatPhase(enc.id, 'ENCOUNTER_END');
        await setPenaiCombatPhase(enc.id, 'IDLE');
    }
    const session = await sessionRepo.findOne({ where: { id: sessionId } });
    if (session) {
        session.activeCombatEncounterId = null;
        await sessionRepo.save(session);
    }
}

export async function startPenaiCombat(
    sessionId: number,
    enemies: Array<{ entityKey: string; displayName: string; hpMax: number; armorClass?: number }>,
): Promise<SessionCombatEncounter> {
    const encRepo = PenaiDataSource.getRepository(SessionCombatEncounter);
    const sessionRepo = PenaiDataSource.getRepository(GameSession);
    const combatantRepo = PenaiDataSource.getRepository(SessionCombatant);

    const enc = await encRepo.save(
        encRepo.create({
            sessionId,
            isActive: true,
            round: 1,
            turn: 0,
            phase: 'ENCOUNTER_ACTIVE',
            initiativeOrder: [],
        }),
    );

    await setPenaiCombatPhase(enc.id, 'ROUND_START');
    await setPenaiCombatPhase(enc.id, 'TURN_START');

    const session = await sessionRepo.findOne({ where: { id: sessionId } });
    const heroId = session?.heroWorldEntityId;
    const combatants: SessionCombatant[] = [];

    if (heroId) {
        const heroStats = await import('../character/heroStats.js').then(m =>
            m.loadHeroSessionStats(sessionId, heroId),
        );
        const heroInit = await rollInitiativeForEntity(heroId, 'hero');
        combatants.push(
            combatantRepo.create({
                encounterId: enc.id,
                entityKey: heroId,
                displayName: 'Herói',
                side: 'hero',
                hpCurrent: heroStats.hp,
                hpMax: heroStats.maxHp,
                armorClass: heroStats.ac,
                initiative: heroInit,
            }),
        );
    }

    for (const e of enemies) {
        const init = await rollInitiativeForEntity(e.entityKey, 'enemy');
        combatants.push(
            combatantRepo.create({
                encounterId: enc.id,
                entityKey: e.entityKey,
                displayName: e.displayName,
                side: 'enemy',
                hpCurrent: e.hpMax,
                hpMax: e.hpMax,
                armorClass: e.armorClass ?? 12,
                initiative: init,
            }),
        );
    }

    await combatantRepo.save(combatants);

    const sorted = [...combatants].sort((a, b) => b.initiative - a.initiative);
    enc.initiativeOrder = sorted.map(c => c.entityKey);
    await encRepo.save(enc);

    if (session) {
        session.activeCombatEncounterId = enc.id;
        await sessionRepo.save(session);
    }

    await syncHeroHpPenai(sessionId);

    const first = sorted[0];
    if (first && first.side !== 'hero') {
        const { appendWorldEvent } = await import('../events/store.js');
        await appendWorldEvent({
            type: 'NPC_TURN_READY',
            sessionId,
            payload: {
                encounterId: enc.id,
                entityKey: first.entityKey,
                displayName: first.displayName,
            },
        });
    }

    return enc;
}

export async function advancePenaiCombatTurnFromIntent(sessionId: number): Promise<PenaiCombatState> {
    await advancePenaiCombatTurn(sessionId);
    return getPenaiCombatState(sessionId);
}

export { advancePenaiCombatTurn };
