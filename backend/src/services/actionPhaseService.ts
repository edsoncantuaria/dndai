import createError from 'http-errors';
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';

const repo = () => AppDataSource.getRepository(SessaoIA);

export const ACTION_PHASE_SEQUENCE = [
    'RECEIVED',
    'NORMALIZED',
    'RULES',
    'AI_SYNTHESIS',
    'DELTA_APPLIED',
] as const;

export type ActionPhase = (typeof ACTION_PHASE_SEQUENCE)[number];

const PHASE_STALE_MS = 120_000;

const isStalePhase = (updatedAt?: Date | null) => {
    if (!updatedAt) return false;
    return Date.now() - updatedAt.getTime() > PHASE_STALE_MS;
};

interface PhaseInput {
    sessionId: number;
    userId: number;
    actionId: string;
    phase: ActionPhase;
}

export const beginActionPhase = async (input: Omit<PhaseInput, 'phase'>) => {
    return upsertPhase({ ...input, phase: 'RECEIVED' });
};

export const advanceActionPhase = async (input: PhaseInput) => {
    if (input.phase === 'RECEIVED') {
        throw createError(400, 'Use beginActionPhase para iniciar o pipeline.');
    }
    return upsertPhase(input);
};

const upsertPhase = async ({ sessionId, userId, actionId, phase }: PhaseInput) => {
    const session = await repo().findOne({
        where: { id: sessionId, userId },
        select: ['id', 'currentActionId', 'currentActionPhase', 'actionPhaseUpdatedAt'],
    });
    if (!session) {
        throw createError(404, 'Sessão não encontrada para controle de fases.');
    }

    const now = new Date();
    const currentId = session.currentActionId;
    const currentPhase = (session.currentActionPhase ?? null) as ActionPhase | null;
    const stale = isStalePhase(session.actionPhaseUpdatedAt);

    if (!currentId || stale) {
        if (phase !== 'RECEIVED') {
            throw createError(409, 'ACTION_PHASE_NOT_INITIALIZED');
        }
        await repo().update(
            { id: sessionId },
            {
                currentActionId: actionId,
                currentActionPhase: phase,
                actionPhaseUpdatedAt: now,
            }
        );
        return { phase, updatedAt: now.toISOString() };
    }

    if (currentId !== actionId) {
        throw createError(409, 'ACTION_PHASE_IN_PROGRESS');
    }

    const currentIndex = currentPhase ? ACTION_PHASE_SEQUENCE.indexOf(currentPhase) : -1;
    const nextIndex = ACTION_PHASE_SEQUENCE.indexOf(phase);
    if (nextIndex === -1) {
        throw createError(400, 'ACTION_PHASE_INVALID');
    }

    if (currentIndex > nextIndex) {
        // Already past this phase; treat as idempotent no-op.
        return { phase: currentPhase ?? phase, updatedAt: session.actionPhaseUpdatedAt?.toISOString() };
    }

    if (nextIndex > currentIndex + 1) {
        throw createError(409, 'ACTION_PHASE_OUT_OF_ORDER');
    }

    await repo().update(
        { id: sessionId },
        {
            currentActionId: actionId,
            currentActionPhase: phase,
            actionPhaseUpdatedAt: now,
        }
    );
    return { phase, updatedAt: now.toISOString() };
};

export const clearActionPhase = async ({ sessionId, actionId }: { sessionId: number; actionId: string }) => {
    await repo().update(
        { id: sessionId, currentActionId: actionId },
        {
            currentActionId: null,
            currentActionPhase: null,
            actionPhaseUpdatedAt: new Date(),
        }
    );
};
