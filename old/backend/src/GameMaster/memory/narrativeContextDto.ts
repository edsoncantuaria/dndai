import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { buildCampaignQuestViews, type CampaignQuestView } from '../sessions/questCampaignHelpers.js';
import {
    loadRecentWorldMemoryLines,
    BOOTSTRAP_MEMORY_TAG,
    PULSE_MEMORY_TAG,
} from './bootstrapMemory.js';
import { getTimelineDeltaForSession } from './timelineEngine.js';

export type WorldPulseBrief = {
    headline: string | null;
    beats: string[];
};

/** Fatos obrigatórios no turno (não dependem só do RAG). */
export async function loadMandatedWorldFacts(sessionId: number, limit = 5): Promise<string[]> {
    const tagged = await loadRecentWorldMemoryLines(sessionId, limit + 2);
    return tagged
        .filter(
            t =>
                t.includes(BOOTSTRAP_MEMORY_TAG) ||
                t.includes(PULSE_MEMORY_TAG) ||
                t.includes('[MISSÃO]') ||
                t.includes('[FATO]'),
        )
        .slice(0, limit);
}

export async function loadLastWorldPulseBrief(sessionId: number): Promise<WorldPulseBrief | null> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    const snap = session?.worldPulseSnapshot as Record<string, unknown> | null;
    if (!snap) return null;
    const headline = typeof snap.headline === 'string' ? snap.headline : null;
    const events = Array.isArray(snap.events) ? snap.events.map(String) : [];
    const beats = Array.isArray(snap.beats) ? snap.beats.map(String) : events.slice(1);
    if (!headline && !beats.length) return null;
    return { headline, beats: beats.slice(0, 4) };
}

export type NarrativeWorldConsult = {
    activeQuests: CampaignQuestView[];
    worldPulse: WorldPulseBrief | null;
    timelineDelta: Awaited<ReturnType<typeof getTimelineDeltaForSession>>;
    mandatedFacts: string[];
};

export async function buildNarrativeWorldConsult(sessionId: number): Promise<NarrativeWorldConsult> {
    const [activeQuests, worldPulse, timelineDelta, mandatedFacts] = await Promise.all([
        buildCampaignQuestViews(sessionId),
        loadLastWorldPulseBrief(sessionId),
        getTimelineDeltaForSession(sessionId, 5),
        loadMandatedWorldFacts(sessionId, 5),
    ]);
    return { activeQuests, worldPulse, timelineDelta, mandatedFacts };
}

/** Mescla fatos mandatados com recall RAG sem duplicar. */
export function mergeSessionFactsWithMandate(
    recalled: string[],
    mandated: string[],
    maxTotal: number,
): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const f of [...mandated, ...recalled]) {
        const key = f.trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(f);
        if (out.length >= maxTotal) break;
    }
    return out;
}
