// backend/src/services/storyService.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { AppDataSource } from '../database/data-source.js';
import redisClient from '../database/redis-client.js';
import { TimelineEvent as TimelineEventEntity } from '../entities/TimelineEvent.js';
import { StorySummary as StorySummaryEntity } from '../entities/StorySummary.js';

interface TimelineEvent {
    turn: number;
    timestamp: string;
    action: string;
    summary: string;
    notes?: string;
}

interface TimelineEventInput {
    timestamp: string;
    action: string;
    summary: string;
    notes?: string;
}

const TIMELINE_KEY = (sessaoId: number) => `session:${sessaoId}:timeline`;
const SUMMARY_KEY = (sessaoId: number) => `session:${sessaoId}:story_summary`;
const SUMMARY_META_KEY = (sessaoId: number) => `session:${sessaoId}:story_summary_meta`;
const STORY_MODEL = 'models/gemini-2.5-flash-lite';

const MAX_TIMELINE_ENTRIES = 200;
const SUMMARY_MIN_BATCH = 5;
const SUMMARY_WINDOW = 12;
const TIMELINE_FACTS_LIMIT = 6;
const LEVEL_UP_RECAP_WINDOW = 14;
const IMPORTANT_KEYWORDS = [
    'miss', 'quest', 'investig', 'combate', 'battle', 'encontro', 'revirav', 'alian', 'derrot',
    'vitoria', 'vitória', 'tesouro', 'artefato', 'relic', 'boss', 'xp', 'level', 'resgat', 'descobriu',
    'descobert', 'surpre', 'traic', 'aliança', 'invas', 'ritual'
];

const safeParse = <T>(value: string | null): T | null => {
    if (!value) return null;
    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
};

const timelineRepository = () => AppDataSource.getRepository(TimelineEventEntity);
const storySummaryRepository = () => AppDataSource.getRepository(StorySummaryEntity);

const toTimelineEventDto = (entity: TimelineEventEntity): TimelineEvent => ({
    turn: entity.turn,
    timestamp: entity.timestamp.toISOString(),
    action: entity.action,
    summary: entity.summary,
    notes: entity.notes ?? undefined,
});

const loadTimelineFromDb = async (sessaoId: number, limit?: number): Promise<TimelineEvent[]> => {
    const repo = timelineRepository();
    const entities = await repo.find({
        where: { sessaoId },
        order: { turn: 'DESC' },
        ...(limit ? { take: limit } : {}),
    });
    return entities.reverse().map(toTimelineEventDto);
};

const cacheTimeline = async (sessaoId: number, events: TimelineEvent[]): Promise<void> => {
    if (!redisClient || !redisClient.isOpen) return;
    const key = TIMELINE_KEY(sessaoId);
    const pipeline = redisClient.multi();
    pipeline.del(key);
    if (events.length) {
        pipeline.rPush(key, events.map(event => JSON.stringify(event)));
        pipeline.lTrim(key, -MAX_TIMELINE_ENTRIES, -1);
    }
    await pipeline.exec();
};

const getTimelineFromCache = async (sessaoId: number): Promise<TimelineEvent[] | null> => {
    if (!redisClient || !redisClient.isOpen) return null;
    const raw = await redisClient.lRange(TIMELINE_KEY(sessaoId), 0, -1);
    if (!raw.length) return null;
    return raw.map(safeParse<TimelineEvent>).filter(Boolean) as TimelineEvent[];
};

export const getTimeline = async (sessaoId: number): Promise<TimelineEvent[]> => {
    const cached = await getTimelineFromCache(sessaoId);
    if (cached && cached.length) return cached;

    const events = await loadTimelineFromDb(sessaoId, MAX_TIMELINE_ENTRIES);
    if (events.length) {
        await cacheTimeline(sessaoId, events);
    }
    return events;
};

const getRecentTimelineEvents = async (sessaoId: number, limit: number): Promise<TimelineEvent[]> => {
    if (limit <= 0) return [];
    const cached = await getTimeline(sessaoId);
    if (cached.length >= limit) {
        return cached.slice(-limit);
    }
    const events = await loadTimelineFromDb(sessaoId, Math.max(limit * 3, limit));
    if (events.length) {
        await cacheTimeline(sessaoId, events.slice(-MAX_TIMELINE_ENTRIES));
    }
    return events.slice(-limit);
};

const isEventRelevant = (event: TimelineEvent): boolean => {
    if (!event) return false;
    const haystack = `${event.summary ?? ''} ${event.notes ?? ''}`.toLowerCase();
    return IMPORTANT_KEYWORDS.some(keyword => haystack.includes(keyword));
};

const formatTimelineEvent = (event: TimelineEvent): string => {
    const summary = (event.summary || 'Sem detalhes.').replace(/\s+/g, ' ').trim();
    const trimmedSummary = summary.length > 180 ? `${summary.slice(0, 177)}…` : summary;
    const notes = event.notes ? ` (Notas: ${event.notes.replace(/\s+/g, ' ').trim()})` : '';
    return `- Turno ${event.turn}: ${trimmedSummary}${notes}`;
};

export const buildTimelineFacts = async (sessaoId: number, limit: number = TIMELINE_FACTS_LIMIT): Promise<string | null> => {
    const events = await getRecentTimelineEvents(sessaoId, limit);
    if (!events.length) return null;

    const relevantEvents = events.filter(isEventRelevant);
    const selected = (relevantEvents.length >= 2 ? relevantEvents : events).slice(-limit);
    if (!selected.length) return null;

    const lines = selected.map(formatTimelineEvent);
    return lines.join('\n');
};

export const getStorySummary = async (sessaoId: number): Promise<string | null> => {
    if (redisClient && redisClient.isOpen) {
        const cached = await redisClient.get(SUMMARY_KEY(sessaoId));
        if (cached) return cached;
    }

    const repo = storySummaryRepository();
    const summary = await repo.findOne({ where: { sessaoId } });
    if (!summary) return null;

    if (redisClient && redisClient.isOpen) {
        await redisClient.set(SUMMARY_KEY(sessaoId), summary.summary);
        await redisClient.set(
            SUMMARY_META_KEY(sessaoId),
            JSON.stringify({ entriesSummarized: summary.entriesSummarized, updatedAt: summary.updatedAt.toISOString() })
        );
    }

    return summary.summary;
};

export const recordTimelineEvent = async (sessaoId: number, event: TimelineEventInput): Promise<void> => {
    await appendTimelineEvent(sessaoId, event);
};

const setStorySummary = async (sessaoId: number, summary: string, entriesSummarized: number) => {
    const repo = storySummaryRepository();
    let entity = await repo.findOne({ where: { sessaoId } });
    if (!entity) {
        entity = repo.create({ sessaoId, summary, entriesSummarized });
    } else {
        entity.summary = summary;
        entity.entriesSummarized = entriesSummarized;
    }
    await repo.save(entity);

    if (redisClient && redisClient.isOpen) {
        await redisClient.set(SUMMARY_KEY(sessaoId), summary);
        await redisClient.set(
            SUMMARY_META_KEY(sessaoId),
            JSON.stringify({ entriesSummarized, updatedAt: new Date().toISOString() })
        );
    }
};

const getSummaryMeta = async (sessaoId: number): Promise<{ entriesSummarized: number } | null> => {
    if (redisClient && redisClient.isOpen) {
        const cached = safeParse<{ entriesSummarized: number }>(await redisClient.get(SUMMARY_META_KEY(sessaoId)));
        if (cached) return cached;
    }

    const repo = storySummaryRepository();
    const summary = await repo.findOne({ where: { sessaoId } });
    if (!summary) return null;

    return { entriesSummarized: summary.entriesSummarized };
};

const appendTimelineEvent = async (
    sessaoId: number,
    event: TimelineEventInput
): Promise<{ events: TimelineEvent[]; totalEvents: number }> => {
    const repo = timelineRepository();
    const lastEvent = await repo.findOne({
        where: { sessaoId },
        order: { turn: 'DESC' },
    });
    const nextTurn = (lastEvent?.turn ?? 0) + 1;

    const entity = repo.create({
        sessaoId,
        turn: nextTurn,
        timestamp: new Date(event.timestamp),
        action: event.action.slice(0, 255),
        summary: event.summary,
        notes: event.notes ?? null,
    });
    await repo.save(entity);

    const events = await loadTimelineFromDb(sessaoId, MAX_TIMELINE_ENTRIES);
    if (events.length) {
        await cacheTimeline(sessaoId, events);
    }

    return { events, totalEvents: nextTurn };
};

const generateStorySummary = async (
    sessaoId: number,
    timeline: TimelineEvent[],
    previousSummary: string | null,
    apiKey: string
): Promise<string | null> => {
    if (!apiKey || timeline.length === 0) return null;

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: STORY_MODEL });

        const recentEvents = timeline.slice(-SUMMARY_WINDOW);
        const eventsText = recentEvents
            .map(event => `- Turno ${event.turn}: ${event.summary}${event.notes ? ` (${event.notes})` : ''}`)
            .join('\n');

        const prompt = `
Você é o cronista oficial da sessão ${sessaoId} de um RPG solo. Gere um resumo conciso (4 a 6 frases) em português do Brasil que capture os acontecimentos principais e o tom da jornada até agora.

Resumo anterior (se existir):
${previousSummary ?? 'Nenhum resumo anterior disponível.'}

Eventos recentes:
${eventsText}

Regras:
- Destaque protagonistas, objetivos, conflitos e consequências.
- Use tempo passado e mantenha coerência com o resumo anterior.
- Não inclua texto fora do resumo.
`;

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.4,
                topP: 0.9,
                topK: 40,
                maxOutputTokens: 512,
            },
        });

        const response = result.response;
        const text = response?.text()?.trim();
        if (text) {
            return text.replace(/\n{3,}/g, '\n\n').trim();
        }
    } catch (error) {
        console.error('[storyService] Falha ao gerar resumo narrativo:', error);
    }

    return null;
};

export const recordTimelineEventAndSummarize = async (
    sessaoId: number,
    event: TimelineEventInput,
    apiKey?: string
): Promise<{ summary: string | null }> => {
    const { events: timeline, totalEvents } = await appendTimelineEvent(sessaoId, event);

    if (!apiKey) {
        return { summary: null };
    }

    const meta = await getSummaryMeta(sessaoId);
    const entriesSummarized = meta?.entriesSummarized ?? 0;
    const pendingEntries = totalEvents - entriesSummarized;

    if (totalEvents >= SUMMARY_MIN_BATCH && pendingEntries >= SUMMARY_MIN_BATCH) {
        queueMicrotask(async () => {
            try {
                const previousSummary = await getStorySummary(sessaoId);
                const summary = await generateStorySummary(sessaoId, timeline, previousSummary, apiKey);
                if (summary) {
                    await setStorySummary(sessaoId, summary, totalEvents);
                }
            } catch (error) {
                console.error('[storyService] Falha ao gerar resumo em background:', error);
            }
        });
    }

    return { summary: null };
};

export const generateLevelUpRecap = async (
    sessaoId: number,
    apiKey: string
): Promise<string | null> => {
    if (!apiKey) return null;

    const timeline = await getTimeline(sessaoId);
    if (!timeline.length) return null;

    const recentEvents = timeline.slice(-LEVEL_UP_RECAP_WINDOW);
    const eventsText = recentEvents
        .map(event => `- Turno ${event.turn}: ${event.summary}${event.notes ? ` (${event.notes})` : ''}`)
        .join('\n');

    if (!eventsText.trim()) return null;

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: STORY_MODEL });

        const prompt = `
Você é o cronista épico da sessão ${sessaoId}. Responda em português do Brasil a pergunta "Como chegamos aqui?" em 2 a 3 frases, destacando os principais eventos que levaram o herói ao novo nível.

Eventos recentes:
${eventsText}

Regras:
- Foque em marcos, desafios superados e aliados chave.
- Use tempo passado e mantenha o tom inspirador.
- Evite listas e menções ao próprio pedido.
`;

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.45,
                topP: 0.9,
                topK: 40,
                maxOutputTokens: 320,
            },
        });

        const recap = result.response?.text()?.trim();
        if (recap) {
            return recap.replace(/\n{3,}/g, '\n\n').trim();
        }
    } catch (error) {
        console.error('[storyService] Falha ao gerar resumo de nível:', error);
    }

    return null;
};
