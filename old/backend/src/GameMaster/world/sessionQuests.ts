import { PenaiDataSource } from '../database/data-source.js';
import { SessionQuest } from '../database/entities/SessionQuest.js';
import { appendWorldEvent } from '../events/store.js';
import { recordProvenanceFact } from '../memory/provenanceMemory.js';
import { getRegionBySlug } from './travelCanon.js';

export type SessionQuestPayload = {
    regionSlug?: string;
    regionName?: string;
    synopsis?: string;
    stageLabel?: string;
    kind?: 'local' | 'travel';
    urgency?: string;
    source?: string;
};

export async function startSessionQuest(opts: {
    sessionId: number;
    questSlug: string;
    title: string;
    payload?: SessionQuestPayload;
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
        payload: { questSlug: opts.questSlug, title: opts.title, ...opts.payload },
    });
    return row;
}

/** Avanço por viagem à região-alvo — sem RNG. */
export async function advanceQuestsOnTravelCompleted(
    sessionId: number,
    arrivedRegionSlug: string,
): Promise<string[]> {
    const repo = PenaiDataSource.getRepository(SessionQuest);
    const active = await repo.find({ where: { sessionId, status: 'active' } });
    const pulses: string[] = [];
    const regionMeta = await getRegionBySlug(arrivedRegionSlug);

    for (const quest of active) {
        const payload = (quest.payload ?? {}) as SessionQuestPayload;
        const targetSlug = String(payload.regionSlug ?? '').trim();
        if (!targetSlug || targetSlug !== arrivedRegionSlug) continue;

        quest.stage += 1;
        quest.advancedAt = new Date();
        const completeAt = payload.kind === 'travel' ? 2 : 3;
        const stageLabel =
            quest.status === 'completed' || quest.stage >= completeAt
                ? 'Concluída'
                : payload.kind === 'travel' && quest.stage === 1
                  ? 'Investigar o local'
                  : (payload.stageLabel ?? 'Investigar o local');
        quest.payload = { ...payload, stageLabel };

        if (quest.stage >= completeAt) {
            quest.status = 'completed';
        }
        await repo.save(quest);

        const ev = await appendWorldEvent({
            type: 'QUEST_STAGE_ADVANCED',
            sessionId,
            payload: {
                questSlug: quest.questSlug,
                stage: quest.stage,
                status: quest.status,
                regionSlug: arrivedRegionSlug,
                reason: 'travel_completed',
            },
        });

        const place = regionMeta?.displayName ?? arrivedRegionSlug;
        const factText =
            quest.status === 'completed'
                ? `Missão "${quest.title}" concluída em ${place}.`
                : `Missão "${quest.title}" avança em ${place} (estágio ${quest.stage}).`;
        pulses.push(factText);

        await recordProvenanceFact({
            sessionId,
            text: factText,
            regionSlug: arrivedRegionSlug,
            sourceEventId: ev.id,
            sourceEventType: 'QUEST_STAGE_ADVANCED',
            importanceScore: quest.status === 'completed' ? 75 : 68,
        });

        await maybeScheduleQuestMacroPulse(sessionId, quest.questSlug, quest.stage, quest.status);
    }

    return pulses;
}

/** Agenda macro-pulso após avanço significativo de missão. */
export async function maybeScheduleQuestMacroPulse(
    sessionId: number,
    questSlug: string,
    stage: number,
    status: string,
): Promise<void> {
    const completeAt = status === 'completed';
    const major = completeAt || stage >= 2;
    if (!major) return;
    const { maybeScheduleWorldPulse } = await import('./simulation/pulseSchedule.js');
    await maybeScheduleWorldPulse(sessionId, 'quest_major', { questSlug, stage });
}

/** Tick de quest: só reforça lembrete — progresso vem de viagem/eventos. */
export async function advanceActiveQuests(sessionId: number): Promise<string[]> {
    const repo = PenaiDataSource.getRepository(SessionQuest);
    const active = await repo.find({ where: { sessionId, status: 'active' }, take: 5 });
    const pulses: string[] = [];

    for (const quest of active) {
        const payload = (quest.payload ?? {}) as SessionQuestPayload;
        const regionName = payload.regionName ?? payload.regionSlug ?? 'outro lugar';
        if (payload.kind === 'travel') {
            pulses.push(`Missão "${quest.title}" aguarda em ${regionName}.`);
        }
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
