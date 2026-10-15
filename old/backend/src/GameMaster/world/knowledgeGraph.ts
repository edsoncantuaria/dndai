import { PenaiDataSource } from '../database/data-source.js';
import { SessionKnowledge } from '../database/entities/SessionKnowledge.js';
import { SessionEntityState } from '../database/entities/SessionEntityState.js';
import { appendWorldEvent } from '../events/store.js';

export async function recordWitnessedFact(opts: {
    sessionId: number;
    factKey: string;
    factText: string;
    witnessEntityIds: string[];
}): Promise<number> {
    const repo = PenaiDataSource.getRepository(SessionKnowledge);
    let count = 0;
    for (const holderEntityId of opts.witnessEntityIds) {
        const exists = await repo.findOne({
            where: { sessionId: opts.sessionId, holderEntityId, factKey: opts.factKey },
        });
        if (exists) continue;
        await repo.save(
            repo.create({
                sessionId: opts.sessionId,
                holderEntityId,
                factKey: opts.factKey,
                factText: opts.factText,
                source: 'witnessed',
            }),
        );
        count++;
    }
    if (count) {
        await appendWorldEvent({
            type: 'WITNESSED',
            sessionId: opts.sessionId,
            payload: { factKey: opts.factKey, holders: opts.witnessEntityIds.length },
        });
    }
    return count;
}

export async function spreadKnowledgeFromRumor(
    sessionId: number,
    holderEntityId: string,
    factKey: string,
    factText: string,
): Promise<void> {
    const repo = PenaiDataSource.getRepository(SessionKnowledge);
    const exists = await repo.findOne({ where: { sessionId, holderEntityId, factKey } });
    if (exists) return;
    await repo.save(
        repo.create({
            sessionId,
            holderEntityId,
            factKey,
            factText,
            source: 'rumor',
        }),
    );
    await appendWorldEvent({
        type: 'KNOWLEDGE_SPREAD',
        sessionId,
        actorEntityId: holderEntityId,
        payload: { factKey },
    });
}

export async function recallKnowledgeForSession(
    sessionId: number,
    limit = 6,
): Promise<string[]> {
    const rows = await PenaiDataSource.getRepository(SessionKnowledge).find({
        where: { sessionId },
        order: { learnedAt: 'DESC' },
        take: limit,
    });
    return rows.map(r => r.factText);
}

export async function listPresentEntityIds(sessionId: number, limit = 12): Promise<string[]> {
    const states = await PenaiDataSource.getRepository(SessionEntityState).find({
        where: { sessionId, appeared: true, sessionAlive: true },
        take: limit,
    });
    return states.map(s => s.worldEntityId);
}
