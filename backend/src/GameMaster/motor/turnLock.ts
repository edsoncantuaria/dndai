import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { hasPendingPenaiRoll } from './penaiRollStore.js';

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
