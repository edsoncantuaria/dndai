import { PenaiDataSource } from '../database/data-source.js';
import { WorldEvent } from '../database/entities/WorldEvent.js';

export async function appendWorldEvent(opts: {
    type: string;
    sessionId?: number | null;
    actorEntityId?: string | null;
    payload?: Record<string, unknown>;
    canonCandidate?: boolean;
}): Promise<WorldEvent> {
    const repo = PenaiDataSource.getRepository(WorldEvent);
    return repo.save(
        repo.create({
            type: opts.type,
            sessionId: opts.sessionId ?? null,
            actorEntityId: opts.actorEntityId ?? null,
            payload: opts.payload ?? {},
            canonCandidate: opts.canonCandidate ?? false,
        }),
    );
}

export async function listSessionWorldEvents(
    sessionId: number,
    limit = 40,
): Promise<Array<{ id: string; type: string; payload: Record<string, unknown>; createdAt: Date }>> {
    const repo = PenaiDataSource.getRepository(WorldEvent);
    const rows = await repo.find({
        where: { sessionId },
        order: { createdAt: 'DESC' },
        take: limit,
    });
    return rows.map(r => ({
        id: r.id,
        type: r.type,
        payload: r.payload,
        createdAt: r.createdAt,
    }));
}
