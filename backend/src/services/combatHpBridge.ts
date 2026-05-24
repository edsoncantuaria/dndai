import {
    loadCombatEncounterState,
    saveCombatEncounterState,
} from './combatStateService.js';
import { runMotorCombatPipeline, type MotorCombatPipelineResult } from './combatMotorService.js';
import { AppDataSource } from '../database/data-source.js';

const normaliseId = (value: string): string => value.trim().toLowerCase();

/**
 * Sincroniza PV de CombatEntity → combatants do encontro da sessão.
 * Chamado após dano/cura estruturado em entidades.
 */
export async function syncEntityHpToSessionCombat(params: {
    sessaoId: number;
    entityId: string;
    hpCurrent: number;
    entityName?: string;
    characterId?: number;
}): Promise<MotorCombatPipelineResult | null> {
    const { sessaoId, entityId, hpCurrent, entityName, characterId } = params;
    const loaded = await loadCombatEncounterState(sessaoId);
    if (!loaded.state?.isActive) return null;

    const entityKey = normaliseId(entityId);
    const nameKey = entityName ? normaliseId(entityName) : null;
    const clampedHp = Math.max(0, Math.floor(hpCurrent));

    let matched = false;
    const combatants = loaded.state.combatants.map(combatant => {
        if (combatant.isPlayer) return combatant;
        const idMatch = normaliseId(combatant.id) === entityKey;
        const nameMatch = nameKey && normaliseId(combatant.name) === nameKey;
        if (!idMatch && !nameMatch) return combatant;
        matched = true;
        const current = Math.min(clampedHp, combatant.hp.max);
        return {
            ...combatant,
            hp: { ...combatant.hp, current },
            isDead: current <= 0,
        };
    });

    if (!matched) return null;

    const stored = { ...loaded.state, combatants };
    return runMotorCombatPipeline({
        sessaoId,
        encounterId: loaded.encounterId,
        stored,
        characterId,
    });
}

/** Sincroniza PV do personagem → combatente `isPlayer` no encontro ativo. */
export async function syncPlayerHpToSessionCombat(params: {
    sessaoId: number;
    hpCurrent: number;
    hpMax?: number;
    characterId?: number;
}): Promise<MotorCombatPipelineResult | null> {
    const { sessaoId, hpCurrent, hpMax, characterId } = params;
    const loaded = await loadCombatEncounterState(sessaoId);
    if (!loaded.state?.isActive) return null;

    const clampedHp = Math.max(0, Math.floor(hpCurrent));
    let matched = false;
    const combatants = loaded.state.combatants.map(combatant => {
        if (!combatant.isPlayer) return combatant;
        matched = true;
        const max = hpMax ?? combatant.hp.max;
        const current = Math.min(clampedHp, max);
        return {
            ...combatant,
            hp: { current, max },
            isDead: current <= 0,
        };
    });

    if (!matched) return null;

    const stored = { ...loaded.state, combatants };
    return runMotorCombatPipeline({
        sessaoId,
        encounterId: loaded.encounterId,
        stored,
        characterId,
    });
}

/** Persiste combate após sync sem rodar pipeline completo (uso interno). */
export async function persistSessionCombatState(
    sessaoId: number,
    encounterId: number | null,
    state: NonNullable<Awaited<ReturnType<typeof loadCombatEncounterState>>['state']>,
): Promise<void> {
    if (!AppDataSource.isInitialized) return;
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
}
