import { PenaiDataSource } from '../database/data-source.js';
import { NarrativeSummary } from '../database/entities/NarrativeSummary.js';
import { startMemoryCompactionWorkflow } from '../../temporal/client.js';

export async function recallNarrativeSummary(sessionId: number): Promise<string | null> {
    const summaryRepo = PenaiDataSource.getRepository(NarrativeSummary);
    const latest = await summaryRepo.findOne({
        where: { sessionId },
        order: { createdAt: 'DESC' },
    });
    return latest?.summary ?? null;
}

/** Dispara compactação assíncrona a cada N turnos narrados. */
export function maybeScheduleMemoryCompaction(opts: {
    sessionId: number;
    actionSequence: number;
    interval?: number;
}): void {
    const interval = opts.interval ?? 8;
    if (opts.actionSequence <= 0 || opts.actionSequence % interval !== 0) return;
    void startMemoryCompactionWorkflow({
        sessionId: opts.sessionId,
        fromActionSequence: Math.max(0, opts.actionSequence - interval),
        toActionSequence: opts.actionSequence,
    });
}

export async function saveNarrativeSummary(opts: {
    sessionId: number;
    summary: string;
    fromActionSequence?: number;
    toActionSequence?: number;
}): Promise<void> {
    const trimmed = opts.summary.trim();
    if (!trimmed) return;
    const repo = PenaiDataSource.getRepository(NarrativeSummary);
    await repo.save(
        repo.create({
            sessionId: opts.sessionId,
            summary: trimmed.slice(0, 4000),
            fromActionSequence: opts.fromActionSequence ?? 0,
            toActionSequence: opts.toActionSequence ?? 0,
            locale: 'pt-BR',
        }),
    );
}
