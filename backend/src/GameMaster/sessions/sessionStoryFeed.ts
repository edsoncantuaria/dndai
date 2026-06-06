import { IsNull } from 'typeorm';
import { PenaiDataSource } from '../database/data-source.js';
import { SessionMemory } from '../database/entities/SessionMemory.js';
import { getGameSession } from './sessionService.js';
import { assertSessionOwner } from './sessionExtras.js';
import {
    isPenaiTurnLocked,
    completePenaiTurnNarration,
    rollbackPenaiTurnOnNarrationFailure,
} from '../motor/turnLock.js';
import { penaiPipelineLog } from '../infra/pipelineLog.js';

export type StoryFeedEntry = {
    id: string;
    timestamp: string;
    content: string;
    tone?: string;
    kind?: string;
    consequences?: string[];
};

function mapMemoryToStoryEntry(row: SessionMemory): StoryFeedEntry {
    return {
        id: row.id,
        timestamp: row.createdAt.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
        }),
        content: row.text,
        tone: row.storyTone ?? undefined,
        kind: row.storyKind ?? 'narration',
    };
}

/** Desbloqueia turno se a narração falhou no worker (actionCursor preso). */
export async function reconcileStaleNarrationLock(sessionId: number): Promise<boolean> {
    const session = await getGameSession(sessionId);
    if (!session || session.actionSequence <= session.actionCursor) return false;

    const memRepo = PenaiDataSource.getRepository(SessionMemory);
    const narrationCount = await memRepo.count({
        where: { sessionId, storyKind: 'narration', decayedAt: IsNull() },
    });

    if (narrationCount >= session.actionSequence) {
        await completePenaiTurnNarration(sessionId, session.actionSequence);
        penaiPipelineLog(
            'NARRATION',
            'actionCursor recuperado (narrações já persistidas)',
            { actionSequence: session.actionSequence, actionCursor: session.actionCursor },
            { sessionId },
        );
        return true;
    }

    const staleMs = Date.now() - new Date(session.updatedAt).getTime();
    if (staleMs > 5 * 60 * 1000) {
        await rollbackPenaiTurnOnNarrationFailure(sessionId, session.actionSequence);
        penaiPipelineLog(
            'NARRATION',
            'lock stale revertido — narração nunca concluiu (sem auto-complete)',
            { actionSequence: session.actionSequence, staleMs },
            { sessionId },
        );
        return true;
    }

    return false;
}

/** Sessão já tem texto narrativo persistido (opening ou turno anterior). */
export async function sessionHasPlayableNarration(sessionId: number): Promise<boolean> {
    const repo = PenaiDataSource.getRepository(SessionMemory);
    const count = await repo
        .createQueryBuilder('m')
        .where('m.sessionId = :sessionId', { sessionId })
        .andWhere('m.decayedAt IS NULL')
        .andWhere("(m.storyKind IS NULL OR m.storyKind IN ('narration', 'system', 'opening'))")
        .andWhere('length(trim(m.text)) > 0')
        .getCount();
    return count > 0;
}

export async function listSessionStoryFeed(sessionId: number, userId: number) {
    await assertSessionOwner(sessionId, userId);
    await reconcileStaleNarrationLock(sessionId);

    const repo = PenaiDataSource.getRepository(SessionMemory);
    const rows = await repo
        .createQueryBuilder('m')
        .where('m.sessionId = :sessionId', { sessionId })
        .andWhere('m.decayedAt IS NULL')
        .andWhere("(m.storyKind IS NULL OR m.storyKind IN ('narration', 'system'))")
        .orderBy('m.createdAt', 'ASC')
        .take(200)
        .getMany();

    const entries: StoryFeedEntry[] = rows.map(mapMemoryToStoryEntry);

    const session = await getGameSession(sessionId);
    const lock = await isPenaiTurnLocked(sessionId);

    return {
        entries,
        spawnBriefing: false,
        pendingNarration: lock.locked,
        pendingReason: lock.reason ?? null,
        actionSequence: session?.actionSequence ?? 0,
        actionCursor: session?.actionCursor ?? 0,
    };
}
