import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { hasPendingPenaiRoll } from './rollStore.js';

export async function isPenaiTurnLocked(sessionId: number): Promise<{ locked: boolean; reason?: string }> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    if (!session) return { locked: true, reason: 'Sessão não encontrada.' };

    if (await hasPendingPenaiRoll(sessionId)) {
        return { locked: true, reason: 'Conclua a rolagem de dados antes de uma nova ação.' };
    }

    if (session.actionSequence > session.actionCursor) {
        return {
            locked: true,
            reason: 'Aguarde o Mestre concluir a narração do turno anterior.',
        };
    }

    return { locked: false };
}

/** Evita segunda chamada LLM em workflow Temporal obsoleto ou turno já narrado. */
export async function isStaleNarrationTurn(
    sessionId: number,
    actionSequence: number,
): Promise<{ stale: boolean; reason?: string }> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    if (!session) return { stale: true, reason: 'Sessão não encontrada.' };
    if (actionSequence < session.actionSequence) {
        return { stale: true, reason: 'Turno substituído por ação mais recente.' };
    }
    if (actionSequence <= session.actionCursor) {
        return { stale: true, reason: 'Narração deste turno já foi concluída.' };
    }
    return { stale: false };
}

export async function completePenaiTurnNarration(
    sessionId: number,
    actionSequence: number,
): Promise<void> {
    const repo = PenaiDataSource.getRepository(GameSession);
    const session = await repo.findOne({ where: { id: sessionId } });
    if (!session) return;
    if (actionSequence > session.actionCursor) {
        session.actionCursor = actionSequence;
        await repo.save(session);
    }
}

/**
 * Reverte contadores do turno quando a narração falha após o mecânico já ter corrido.
 * Não recompõe inventário/combate — apenas desfaz sequence/cursor mismatch e stateVersion extra.
 */
export async function rollbackPenaiTurnOnNarrationFailure(
    sessionId: number,
    actionSequence: number,
): Promise<{
    actionCursor: number;
    actionSequence: number;
    stateVersion: number;
} | null> {
    const repo = PenaiDataSource.getRepository(GameSession);
    const session = await repo.findOne({ where: { id: sessionId } });
    if (!session) return null;

    if (actionSequence <= session.actionCursor) {
        return {
            actionCursor: session.actionCursor,
            actionSequence: session.actionSequence,
            stateVersion: session.stateVersion,
        };
    }

    if (session.actionSequence === actionSequence && actionSequence > 0) {
        session.actionSequence = actionSequence - 1;
    }
    if (session.stateVersion > 0) {
        session.stateVersion -= 1;
    }
    await repo.save(session);

    return {
        actionCursor: session.actionCursor,
        actionSequence: session.actionSequence,
        stateVersion: session.stateVersion,
    };
}
