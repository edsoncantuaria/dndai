import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';

const sessionSequenceCache = new Map<number, number>();

/** Incrementa e retorna o sequence autoritativo da sessão (ao enfileirar narração). */
export async function allocateActionSequence(sessionId: number): Promise<number> {
    const repo = AppDataSource.getRepository(SessaoIA);
    await repo.increment({ id: sessionId }, 'actionSequence', 1);
    const row = await repo.findOne({
        where: { id: sessionId },
        select: ['id', 'actionSequence'],
    });
    const next = row?.actionSequence ?? 1;
    sessionSequenceCache.set(sessionId, next);
    return next;
}

export async function getLatestActionSequence(sessionId: number): Promise<number> {
    const cached = sessionSequenceCache.get(sessionId);
    if (cached !== undefined) return cached;
    const repo = AppDataSource.getRepository(SessaoIA);
    const row = await repo.findOne({
        where: { id: sessionId },
        select: ['id', 'actionSequence'],
    });
    const latest = row?.actionSequence ?? 0;
    sessionSequenceCache.set(sessionId, latest);
    return latest;
}

export function setCachedActionSequence(sessionId: number, sequence: number): void {
    sessionSequenceCache.set(sessionId, sequence);
}

/** Job de narração ficou obsoleto (ação mais nova já enfileirada). */
export async function isStaleNarrationSequence(
    sessionId: number,
    jobSequence: number | undefined,
): Promise<boolean> {
    if (jobSequence == null || !Number.isFinite(jobSequence)) return false;
    const latest = await getLatestActionSequence(sessionId);
    return jobSequence < latest;
}
