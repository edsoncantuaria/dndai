// backend/src/services/storyService.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import redisClient from '../database/redis-client.js';

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

const MAX_TIMELINE_ENTRIES = 200;
const SUMMARY_MIN_BATCH = 5;
const SUMMARY_WINDOW = 12;

const safeParse = <T>(value: string | null): T | null => {
    if (!value) return null;
    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
};

const appendTimelineEvent = async (sessaoId: number, event: TimelineEventInput): Promise<TimelineEvent[]> => {
    if (!redisClient || !redisClient.isOpen) return [];

    const key = TIMELINE_KEY(sessaoId);
    const rawItems = await redisClient.lRange(key, 0, -1);
    const events = rawItems.map(safeParse<TimelineEvent>).filter(Boolean) as TimelineEvent[];

    const turn = events.length + 1;
    const storedEvent: TimelineEvent = {
        turn,
        ...event,
    };

    await redisClient.rPush(key, JSON.stringify(storedEvent));
    await redisClient.lTrim(key, -MAX_TIMELINE_ENTRIES, -1);

    const updatedRaw = await redisClient.lRange(key, 0, -1);
    return updatedRaw.map(safeParse<TimelineEvent>).filter(Boolean) as TimelineEvent[];
};

export const getTimeline = async (sessaoId: number): Promise<TimelineEvent[]> => {
    if (!redisClient || !redisClient.isOpen) return [];
    const raw = await redisClient.lRange(TIMELINE_KEY(sessaoId), 0, -1);
    return raw.map(safeParse<TimelineEvent>).filter(Boolean) as TimelineEvent[];
};

export const getStorySummary = async (sessaoId: number): Promise<string | null> => {
    if (!redisClient || !redisClient.isOpen) return null;
    return await redisClient.get(SUMMARY_KEY(sessaoId));
};

const setStorySummary = async (sessaoId: number, summary: string) => {
    if (!redisClient || !redisClient.isOpen) return;
    await redisClient.set(SUMMARY_KEY(sessaoId), summary);
    await redisClient.set(
        SUMMARY_META_KEY(sessaoId),
        JSON.stringify({ entriesSummarized: (await getTimeline(sessaoId)).length, updatedAt: new Date().toISOString() })
    );
};

const getSummaryMeta = async (sessaoId: number): Promise<{ entriesSummarized: number } | null> => {
    if (!redisClient || !redisClient.isOpen) return null;
    return safeParse(await redisClient.get(SUMMARY_META_KEY(sessaoId)));
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
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

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
    if (!redisClient || !redisClient.isOpen) {
        return { summary: null };
    }

    const timeline = await appendTimelineEvent(sessaoId, event);

    if (!apiKey) {
        return { summary: null };
    }

    const meta = await getSummaryMeta(sessaoId);
    const entriesSummarized = meta?.entriesSummarized ?? 0;
    const pendingEntries = timeline.length - entriesSummarized;

    if (timeline.length >= SUMMARY_MIN_BATCH && pendingEntries >= SUMMARY_MIN_BATCH) {
        const previousSummary = await getStorySummary(sessaoId);
        const summary = await generateStorySummary(sessaoId, timeline, previousSummary, apiKey);
        if (summary) {
            await setStorySummary(sessaoId, summary);
            return { summary };
        }
    }

    return { summary: null };
};
