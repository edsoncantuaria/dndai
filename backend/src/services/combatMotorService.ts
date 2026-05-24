import { AppDataSource } from '../database/data-source.js';
import type { CombatState } from '../schemas/gameSchemas.js';
import type { LootOffer } from '../schemas/gameSchemas.js';
import {
    loadCombatEncounterState,
    saveCombatEncounterState,
    reconcileCombatStateUpdate,
    projectPublicCombatState,
    type CombatReconciliationResult,
    type LoadedCombatEncounter,
} from './combatStateService.js';
import { awardMotorXpToCharacter } from './motorXpService.js';
import { buildCombatVictoryLoot, stageMotorLootOffer } from './lootMotorService.js';
import { calculateCombatXp } from './xpService.js';

type CanonicalCombatState = NonNullable<LoadedCombatEncounter['state']>;

export type MotorCombatPipelineResult = CombatReconciliationResult & {
    encounterId: number | null;
    combatEnded: boolean;
    rewards?: {
        xpAwarded: number;
        lootOffer: LootOffer;
        telemetry: string[];
    };
};

const normaliseId = (value: string): string => value.trim().toLowerCase();

/** Regras de fim de combate (motor autoritativo — espelha combatStateService). */
export function evaluateCombatAutoEnd(state: CanonicalCombatState): {
    state: CanonicalCombatState;
    ended: boolean;
    telemetry: string[];
} {
    const telemetry: string[] = [];
    if (!state.isActive) {
        return { state, ended: false, telemetry };
    }

    const anyHostileAlive = state.combatants.some(
        c => c.attitude === 'hostile' && c.hp.current > 0 && !c.isDead,
    );
    const playerAlive = state.combatants.some(
        c => c.isPlayer && c.hp.current > 0 && !c.isDead,
    );

    if (!anyHostileAlive) {
        return {
            state: { ...state, isActive: false },
            ended: true,
            telemetry: ['Combate encerrado automaticamente: nenhum inimigo hostil permanece em pé.'],
        };
    }
    if (!playerAlive) {
        return {
            state: { ...state, isActive: false },
            ended: true,
            telemetry: ['Combate encerrado automaticamente: o personagem do jogador caiu ou se retirou.'],
        };
    }

    return { state, ended: false, telemetry };
}

/**
 * Aceita apenas redução de PV em hostis vindos do cliente (anti-cheat).
 * Nunca aumenta HP de hostil nem altera o jogador via payload do cliente.
 */
export function mergeClientHostileHpHints(
    stored: CanonicalCombatState,
    client: CombatState,
): { state: CanonicalCombatState; telemetry: string[] } {
    const telemetry: string[] = [];
    if (!client?.isActive || !Array.isArray(client.combatants)) {
        return { state: stored, telemetry };
    }

    const clientById = new Map<string, { hp?: { current?: number } }>();
    for (const c of client.combatants) {
        if (c?.id) clientById.set(normaliseId(c.id), c);
    }

    const combatants = stored.combatants.map(existing => {
        if (existing.isPlayer || existing.attitude !== 'hostile') return existing;
        const hint = clientById.get(normaliseId(existing.id));
        if (!hint?.hp || typeof hint.hp.current !== 'number') return existing;

        const proposed = Math.max(0, Math.floor(hint.hp.current));
        if (proposed >= existing.hp.current) return existing;

        telemetry.push(`[Motor] PV de ${existing.name} sincronizado: ${existing.hp.current} → ${proposed}`);
        return {
            ...existing,
            hp: { ...existing.hp, current: proposed },
            isDead: proposed <= 0,
        };
    });

    return { state: { ...stored, combatants }, telemetry };
}

async function persistCombatState(
    sessaoId: number,
    encounterId: number | null,
    state: CanonicalCombatState | null,
): Promise<number | null> {
    if (!AppDataSource.isInitialized) return encounterId;

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
        await saveCombatEncounterState(queryRunner, sessaoId, encounterId, state);
        await queryRunner.commitTransaction();
    } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
    } finally {
        await queryRunner.release();
    }

    const loaded = await loadCombatEncounterState(sessaoId);
    return loaded.encounterId;
}

async function grantCombatVictoryRewards(
    sessaoId: number,
    characterId: number,
    state: CanonicalCombatState,
): Promise<MotorCombatPipelineResult['rewards']> {
    const hostiles = state.combatants.filter(c => c.attitude === 'hostile');
    const hostileCount = Math.max(1, hostiles.length);
    const difficulty =
        hostileCount >= 4 ? 'hard' : hostileCount >= 2 ? 'medium' : 'easy';

    const xpAmount = calculateCombatXp(undefined, difficulty === 'hard' ? 'hard' : difficulty === 'easy' ? 'easy' : 'medium');
    const telemetry: string[] = [];

    if (xpAmount > 0) {
        const xpResult = await awardMotorXpToCharacter(characterId, [
            {
                type: 'combat',
                difficulty: difficulty === 'hard' ? 'hard' : difficulty === 'easy' ? 'easy' : 'medium',
                description: `Vitória no encontro (rodada ${state.round}).`,
            },
        ]);
        if (xpResult?.applied.totalXpAwarded) {
            telemetry.push(`[Motor] +${xpResult.applied.totalXpAwarded} XP por vitória em combate.`);
        }
    }

    const lootOffer = buildCombatVictoryLoot({
        hostileCount,
        round: state.round,
        difficulty,
    });
    await stageMotorLootOffer(sessaoId, lootOffer);
    telemetry.push(`[Motor] Loot pendente: ${lootOffer.currency?.gp ?? 0} gp (claim-loot na ficha).`);

    return {
        xpAwarded: xpAmount,
        lootOffer,
        telemetry,
    };
}

/**
 * Pipeline de combate no modo motor: bootstrap, sync de PV hostis, fim automático, XP/loot.
 */
export async function runMotorCombatPipeline(params: {
    sessaoId: number;
    encounterId: number | null;
    stored: CanonicalCombatState | null;
    clientCombat?: CombatState | null;
    characterId?: number;
}): Promise<MotorCombatPipelineResult> {
    const { sessaoId, characterId, clientCombat } = params;
    let encounterId = params.encounterId;
    let stored = params.stored;
    const wasActive = Boolean(stored?.isActive);

    const allTelemetry: string[] = [];

    if (!stored && clientCombat?.isActive) {
        const bootstrap = reconcileCombatStateUpdate(null, clientCombat);
        if (bootstrap.canonicalState) {
            stored = bootstrap.canonicalState;
            allTelemetry.push(...bootstrap.telemetry);
        }
    }

    if (stored && clientCombat?.isActive) {
        const merged = mergeClientHostileHpHints(stored, clientCombat);
        stored = merged.state;
        allTelemetry.push(...merged.telemetry);
    }

    let combatEnded = false;
    let rewards: MotorCombatPipelineResult['rewards'];

    if (stored) {
        const endEval = evaluateCombatAutoEnd(stored);
        stored = endEval.state;
        allTelemetry.push(...endEval.telemetry);
        combatEnded = wasActive && endEval.ended;

        if (combatEnded && characterId) {
            rewards = await grantCombatVictoryRewards(sessaoId, characterId, stored);
            allTelemetry.push(...(rewards?.telemetry ?? []));
        }
    }

    if (stored || encounterId !== null) {
        encounterId = await persistCombatState(sessaoId, encounterId, stored);
    }

    const publicState = projectPublicCombatState(stored);

    return {
        canonicalState: stored,
        publicState,
        changed: allTelemetry.length > 0 || combatEnded,
        telemetry: allTelemetry,
        encounterId,
        combatEnded,
        rewards,
    };
}

/** Chamada rápida após rolagem/dano quando o cliente envia combatState atualizado. */
export async function postMotorCombatSync(
    sessaoId: number,
    options: {
        clientCombat?: CombatState | null;
        characterId?: number;
    } = {},
): Promise<MotorCombatPipelineResult | null> {
    const loaded = await loadCombatEncounterState(sessaoId);
    if (!loaded.state && !options.clientCombat?.isActive) {
        return null;
    }
    return runMotorCombatPipeline({
        sessaoId,
        encounterId: loaded.encounterId,
        stored: loaded.state,
        clientCombat: options.clientCombat,
        characterId: options.characterId,
    });
}
