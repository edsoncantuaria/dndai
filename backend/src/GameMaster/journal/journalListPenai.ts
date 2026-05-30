import createError from 'http-errors';
import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { WorldEvent } from '../database/entities/WorldEvent.js';

export type PenaiJournalEntry = {
    id: number;
    title: string;
    body: string;
    tags: string[];
    createdAt: string;
};

async function assertSessionOwner(sessionId: number, userId: number): Promise<void> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId, userId },
    });
    if (!session) throw createError(404, 'Sessão não encontrada.');
}

export async function listPenaiJournalEntries(
    sessionId: number,
    userId: number,
): Promise<PenaiJournalEntry[]> {
    await assertSessionOwner(sessionId, userId);
    const events = await PenaiDataSource.getRepository(WorldEvent).find({
        where: { sessionId, type: 'JOURNAL_ENTRY' },
        order: { createdAt: 'DESC' },
        take: 50,
    });

    return events.map(ev => {
        const p = (ev.payload ?? {}) as Record<string, unknown>;
        return {
            id: ev.id,
            title: String(p.title ?? 'Entrada'),
            body: String(p.body ?? ''),
            tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
            createdAt: ev.createdAt.toISOString(),
        };
    });
}
