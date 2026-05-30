import { PenaiDataSource } from '../database/data-source.js';
import { WorldEvent } from '../database/entities/WorldEvent.js';
import {
    recordTimelineEntry,
    shouldIndexTimelineEvent,
} from '../memory/timelineIndex.js';

export async function appendWorldEvent(opts: {
    type: string;
    sessionId?: number | null;
    actorEntityId?: string | null;
    payload?: Record<string, unknown>;
    canonCandidate?: boolean;
}): Promise<WorldEvent> {
    const payload = { ...(opts.payload ?? {}) };
    let shardId: string | null = null;
    if (opts.sessionId) {
        const { resolveSessionShardId } = await import('../world/shardResolver.js');
        shardId = await resolveSessionShardId(opts.sessionId);
        if (shardId) payload.shardId = shardId;
    }

    const repo = PenaiDataSource.getRepository(WorldEvent);
    const row = await repo.save(
        repo.create({
            type: opts.type,
            sessionId: opts.sessionId ?? null,
            actorEntityId: opts.actorEntityId ?? null,
            payload,
            canonCandidate: opts.canonCandidate ?? false,
        }),
    );

    if (opts.sessionId && shouldIndexTimelineEvent(opts.type)) {
        void recordTimelineEntry({
            sessionId: opts.sessionId,
            eventId: row.id,
            eventType: opts.type,
            payload: row.payload,
            createdAt: row.createdAt,
        }).catch(() => undefined);
        if (shardId) {
            const { bumpShardVersion } = await import('../world/shardResolver.js');
            void bumpShardVersion(shardId).catch(() => undefined);
        }
    }

    return row;
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
