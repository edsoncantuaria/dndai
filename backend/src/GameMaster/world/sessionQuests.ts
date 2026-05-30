import { PenaiDataSource } from '../database/data-source.js';
import { SessionQuest } from '../database/entities/SessionQuest.js';
import { appendWorldEvent } from '../events/store.js';

export async function startSessionQuest(opts: {
    sessionId: number;
    questSlug: string;
    title: string;
    payload?: Record<string, unknown>;
}): Promise<SessionQuest> {
    const repo = PenaiDataSource.getRepository(SessionQuest);
    const existing = await repo.findOne({
        where: { sessionId: opts.sessionId, questSlug: opts.questSlug },
    });
    if (existing) return existing;

    const row = await repo.save(
        repo.create({
            sessionId: opts.sessionId,
            questSlug: opts.questSlug,
            title: opts.title,
            status: 'active',
            stage: 0,
            payload: opts.payload ?? {},
        }),
    );

    await appendWorldEvent({
        type: 'QUEST_STARTED',
        sessionId: opts.sessionId,
        payload: { questSlug: opts.questSlug, title: opts.title },
    });
    return row;
}

export async function advanceActiveQuests(sessionId: number): Promise<string[]> {
    const repo = PenaiDataSource.getRepository(SessionQuest);
    const active = await repo.find({ where: { sessionId, status: 'active' }, take: 5 });
    const pulses: string[] = [];

    for (const quest of active) {
        if (Math.random() > 0.35) continue;
        quest.stage += 1;
        quest.advancedAt = new Date();
        if (quest.stage >= 5) {
            quest.status = 'completed';
        }
        await repo.save(quest);

        await appendWorldEvent({
            type: 'QUEST_STAGE_ADVANCED',
            sessionId,
            payload: { questSlug: quest.questSlug, stage: quest.stage, status: quest.status },
        });
        pulses.push(`Quest "${quest.title}" avança para estágio ${quest.stage}.`);
    }

    return pulses;
}

export async function listActiveQuests(sessionId: number): Promise<SessionQuest[]> {
    return PenaiDataSource.getRepository(SessionQuest).find({
        where: { sessionId, status: 'active' },
        order: { startedAt: 'ASC' },
        take: 10,
    });
}
