import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { SessionCombatEncounter } from '../database/entities/SessionCombatEncounter.js';
import { SessionCombatant } from '../database/entities/SessionCombatant.js';
import {
    assertCombatPhaseTransition,
    type CombatPhase,
    canTransitionCombatPhase,
} from '../../combat/combatPhase.js';
import { appendWorldEvent } from '../events/store.js';

const COMBAT_NARRATION_PHASES: CombatPhase[] = ['RESOLVING', 'AWAITING_NARRATION'];

export function normalizePenaiCombatPhase(phase: string | null | undefined): CombatPhase {
    if (!phase || phase === 'ACTIVE') return 'ENCOUNTER_ACTIVE';
    if (phase === 'ENDED') return 'ENCOUNTER_END';
    return phase as CombatPhase;
}

export function isPenaiCombatNarrationPhase(phase: CombatPhase): boolean {
    return COMBAT_NARRATION_PHASES.includes(phase);
}

export async function getActivePenaiCombatPhase(sessionId: number): Promise<CombatPhase | null> {
    if (!PenaiDataSource.isInitialized) return null;
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    if (!session?.activeCombatEncounterId) return null;
    const enc = await PenaiDataSource.getRepository(SessionCombatEncounter).findOne({
        where: { id: session.activeCombatEncounterId, isActive: true },
    });
    if (!enc) return null;
    return normalizePenaiCombatPhase(enc.phase);
}

export async function shouldAllowPenaiCombatNarration(sessionId: number): Promise<boolean> {
    const phase = await getActivePenaiCombatPhase(sessionId);
    if (phase === null) return true;
    return isPenaiCombatNarrationPhase(phase);
}

export async function setPenaiCombatPhase(
    encounterId: number,
    next: CombatPhase,
): Promise<CombatPhase> {
    const repo = PenaiDataSource.getRepository(SessionCombatEncounter);
    const enc = await repo.findOne({ where: { id: encounterId } });
    if (!enc) return 'IDLE';
    const current = normalizePenaiCombatPhase(enc.phase);
    if (next === current) return current;
    assertCombatPhaseTransition(current, next);
    enc.phase = next;
    await repo.save(enc);
    return next;
}

export async function advancePenaiCombatPhaseAfterRoll(
    sessionId: number,
    opts: { hasFollowUpRoll: boolean; shouldNarrate: boolean },
): Promise<CombatPhase | null> {
    if (!PenaiDataSource.isInitialized) return null;
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    if (!session?.activeCombatEncounterId) return null;

    const repo = PenaiDataSource.getRepository(SessionCombatEncounter);
    const enc = await repo.findOne({ where: { id: session.activeCombatEncounterId, isActive: true } });
    if (!enc) return null;

    const current = normalizePenaiCombatPhase(enc.phase);
    let next: CombatPhase = current;

    if (opts.hasFollowUpRoll) {
        next = 'ROLL_PENDING';
    } else if (opts.shouldNarrate && canTransitionCombatPhase(current, 'AWAITING_NARRATION')) {
        next = 'AWAITING_NARRATION';
    } else if (canTransitionCombatPhase(current, 'RESOLVING')) {
        next = 'RESOLVING';
    }

    if (next === current) return current;
    return setPenaiCombatPhase(enc.id, next);
}

export async function advancePenaiCombatPhaseAfterNarration(sessionId: number): Promise<void> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    if (!session?.activeCombatEncounterId) return;
    const enc = await PenaiDataSource.getRepository(SessionCombatEncounter).findOne({
        where: { id: session.activeCombatEncounterId, isActive: true },
    });
    if (!enc) return;
    const current = normalizePenaiCombatPhase(enc.phase);
    if (current === 'AWAITING_NARRATION') {
        await setPenaiCombatPhase(enc.id, 'TURN_END');
    }
}

function livingOrder(order: string[], combatants: SessionCombatant[]): string[] {
    return order.filter(k => {
        const c = combatants.find(x => x.entityKey === k);
        if (!c) return false;
        if (c.hpCurrent > 0) return true;
        return c.side === 'hero';
    });
}

export async function advancePenaiCombatTurn(sessionId: number): Promise<{
    round: number;
    turn: number;
    currentEntityKey: string | null;
    isNpcTurn: boolean;
}> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    if (!session?.activeCombatEncounterId) {
        return { round: 0, turn: 0, currentEntityKey: null, isNpcTurn: false };
    }

    const encRepo = PenaiDataSource.getRepository(SessionCombatEncounter);
    const enc = await encRepo.findOne({
        where: { id: session.activeCombatEncounterId, isActive: true },
        relations: ['combatants'],
    });
    if (!enc) {
        return { round: 0, turn: 0, currentEntityKey: null, isNpcTurn: false };
    }

    const order = livingOrder(enc.initiativeOrder ?? [], enc.combatants ?? []);
    if (!order.length) {
        await setPenaiCombatPhase(enc.id, 'ENCOUNTER_END');
        return { round: enc.round, turn: enc.turn, currentEntityKey: null, isNpcTurn: false };
    }

    let nextTurn = enc.turn + 1;
    let nextRound = enc.round;
    if (nextTurn >= order.length) {
        nextTurn = 0;
        nextRound += 1;
        await setPenaiCombatPhase(enc.id, 'ROUND_START');
        await setPenaiCombatPhase(enc.id, 'TURN_START');
    } else {
        await setPenaiCombatPhase(enc.id, 'TURN_END');
        await setPenaiCombatPhase(enc.id, 'TURN_START');
    }

    enc.turn = nextTurn;
    enc.round = nextRound;
    await encRepo.save(enc);

    const currentKey = order[nextTurn] ?? null;
    const currentCombatant = (enc.combatants ?? []).find(c => c.entityKey === currentKey);
    const isNpcTurn = currentCombatant != null && currentCombatant.side === 'enemy';

    if (isNpcTurn) {
        await appendWorldEvent({
            type: 'NPC_TURN_READY',
            sessionId,
            payload: {
                encounterId: enc.id,
                entityKey: currentKey,
                displayName: currentCombatant?.displayName,
            },
        });
    }

    return { round: nextRound, turn: nextTurn, currentEntityKey: currentKey, isNpcTurn };
}
