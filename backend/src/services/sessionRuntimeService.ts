import createError from 'http-errors';
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';

const DEFAULT_LEASE_TTL_MS = 60_000;

const sanitizeClientInstanceId = (raw: string | null | undefined, userId: number) => {
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed.length > 0) {
            return trimmed.slice(0, 64);
        }
    }
    return `legacy-user-${userId}`;
};

type LeaseMutationMode = 'acquire' | 'heartbeat';

interface LeaseMutationInput {
    sessionId: number;
    userId: number;
    clientInstanceId?: string | null;
    ttlMs?: number;
    allowTakeover?: boolean;
    mode: LeaseMutationMode;
}

const upsertLease = async ({
    sessionId,
    userId,
    clientInstanceId,
    ttlMs = DEFAULT_LEASE_TTL_MS,
    allowTakeover = false,
    mode,
}: LeaseMutationInput) => {
    const repo = AppDataSource.getRepository(SessaoIA);
    const session = await repo.findOne({
        where: { id: sessionId, userId },
        select: ['id', 'leaseOwnerClientId', 'leaseExpiresAt'],
    });
    if (!session) {
        throw createError(404, 'Sessão não encontrada para controle de lease.');
    }

    const now = new Date();
    const effectiveClientId = sanitizeClientInstanceId(clientInstanceId, userId);
    const leaseOwner = session.leaseOwnerClientId;
    const leaseActive =
        Boolean(leaseOwner) &&
        session.leaseExpiresAt instanceof Date &&
        session.leaseExpiresAt.getTime() > now.getTime();

    if (leaseActive && leaseOwner !== effectiveClientId && !allowTakeover) {
        console.warn(`[sessionLease:${mode}] conflito de lease detectado`, {
            sessionId,
            userId,
            leaseOwner,
            requester: effectiveClientId,
        });
        throw createError(409, 'SESSION_LEASE_CONFLICT');
    }

    const expiresAt = new Date(now.getTime() + ttlMs);
    await repo.update(
        { id: sessionId },
        {
            leaseOwnerClientId: effectiveClientId,
            leaseExpiresAt: expiresAt,
            lastHeartbeatAt: now,
        }
    );
    return { leaseOwnerClientId: effectiveClientId, expiresAt };
};

export const acquireSessionLeaseOrThrow = async (input: Omit<LeaseMutationInput, 'mode'>) => {
    return upsertLease({ ...input, mode: 'acquire', allowTakeover: input.allowTakeover ?? false });
};

export const heartbeatSessionLeaseOrThrow = async (input: Omit<LeaseMutationInput, 'mode'>) => {
    return upsertLease({ ...input, mode: 'heartbeat', allowTakeover: input.allowTakeover ?? false });
};

interface ActionCursorInput {
    sessionId: number;
    userId: number;
    incomingCursor?: number | null;
}

export const validateAndPersistActionCursor = async ({
    sessionId,
    userId,
    incomingCursor,
}: ActionCursorInput) => {
    if (incomingCursor == null) {
        return null;
    }
    const repo = AppDataSource.getRepository(SessaoIA);
    const session = await repo.findOne({
        where: { id: sessionId, userId },
        select: ['id', 'actionCursor'],
    });
    if (!session) {
        throw createError(404, 'Sessão não encontrada para validação de actionCursor.');
    }
    const currentCursor = session.actionCursor ?? 0;
    if (incomingCursor <= currentCursor) {
        console.warn('[sessionCursor] cursor regressivo detectado', {
            sessionId,
            userId,
            currentCursor,
            incomingCursor,
        });
        throw createError(409, 'ACTION_CURSOR_STALE');
    }
    await repo.update({ id: sessionId }, { actionCursor: incomingCursor });
    return { previousCursor: currentCursor, updatedCursor: incomingCursor };
};
