import createError from 'http-errors';
import { AppDataSource } from '../database/data-source.js';
import type { CombatState } from '../schemas/gameSchemas.js';
import {
    loadCombatEncounterState,
    projectPublicCombatState,
    reconcileCombatStateUpdate,
} from './combatStateService.js';
import type { StartEncounterPayload } from '../rules/combatEncounterMotor.js';

/** Inicia encontro autoritativo a partir de payload estruturado. */
export async function startMotorEncounter(
    sessaoId: number,
    payload: StartEncounterPayload,
): Promise<{ combatState: CombatState; encounterId: number | null }> {
    const proposed: CombatState = {
        isActive: true,
        round: Math.max(1, payload.round ?? 1),
        turn: Math.max(0, payload.turn ?? 0),
        initiativeOrder: [],
        combatants: payload.combatants.map(c => ({
            id: c.id,
            name: c.name,
            hp: { current: Math.max(0, c.hp), max: Math.max(1, c.maxHp) },
            ac: c.ac,
            isPlayer: Boolean(c.isPlayer),
            attitude: c.isPlayer ? 'ally' : (c.attitude ?? 'hostile'),
            initiative: c.initiative,
            conditions: [],
            hasMoved: false,
            hasActed: false,
            isDead: c.hp <= 0,
            actionPoints: 3,
            bonusActionPoints: 1,
            rollHistory: [],
        })),
    };

    proposed.initiativeOrder = proposed.combatants
        .slice()
        .sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0))
        .map(c => c.id);

    const loaded = await loadCombatEncounterState(sessaoId);
    if (loaded.state?.isActive) {
        throw createError(409, 'Combate já está ativo nesta sessão.');
    }

    const bootstrap = reconcileCombatStateUpdate(null, proposed);
    if (!bootstrap.canonicalState || !bootstrap.publicState) {
        throw createError(422, 'Não foi possível inicializar o encontro.');
    }

    if (!AppDataSource.isInitialized) {
        return { combatState: bootstrap.publicState, encounterId: loaded.encounterId };
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
        const { saveCombatEncounterState } = await import('./combatStateService.js');
        await saveCombatEncounterState(
            queryRunner,
            sessaoId,
            loaded.encounterId,
            bootstrap.canonicalState,
        );
        await queryRunner.commitTransaction();
    } catch (error) {
        await queryRunner.rollbackTransaction();
        throw error;
    } finally {
        await queryRunner.release();
    }

    const after = await loadCombatEncounterState(sessaoId);
    return {
        combatState: projectPublicCombatState(after.state) ?? bootstrap.publicState,
        encounterId: after.encounterId,
    };
}
