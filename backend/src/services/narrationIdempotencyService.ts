import type { EntityManager } from 'typeorm';
import { AppDataSource } from '../database/data-source.js';
import { NarrationCompletion } from '../entities/NarrationCompletion.js';

function isDuplicateKeyError(error: unknown): boolean {
    const err = error as { code?: string; errno?: number };
    return err?.code === 'ER_DUP_ENTRY' || err?.errno === 1062;
}

/** Já persistimos narração para esta ação. */
export async function isNarrationPersistenceCompleted(
    sessionId: number,
    actionId: string | null | undefined,
): Promise<boolean> {
    if (!actionId?.trim()) return false;
    const repo = AppDataSource.getRepository(NarrationCompletion);
    const row = await repo.findOne({
        where: { sessionId, actionId },
        select: ['id'],
    });
    return Boolean(row);
}

/**
 * Reserva persistência (unique sessionId+actionId).
 * @returns true se esta execução deve persistir; false se outra já completou.
 */
export async function tryClaimNarrationPersistence(
    sessionId: number,
    actionId: string,
    actionSequence?: number | null,
): Promise<boolean> {
    const repo = AppDataSource.getRepository(NarrationCompletion);
    try {
        await repo.insert({
            sessionId,
            actionId,
            actionSequence: actionSequence ?? null,
        });
        return true;
    } catch (error) {
        if (isDuplicateKeyError(error)) return false;
        throw error;
    }
}

/** Claim dentro da transação de persistNarrationTurn (rollback se falhar depois). */
export async function tryClaimNarrationPersistenceTx(
    manager: EntityManager,
    sessionId: number,
    actionId: string,
    actionSequence?: number | null,
): Promise<boolean> {
    try {
        await manager.insert(NarrationCompletion, {
            sessionId,
            actionId,
            actionSequence: actionSequence ?? null,
        });
        return true;
    } catch (error) {
        if (isDuplicateKeyError(error)) return false;
        throw error;
    }
}
