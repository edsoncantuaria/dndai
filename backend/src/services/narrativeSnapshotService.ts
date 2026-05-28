import redisClient from '../database/redis-client.js';
import { getStorySummary, buildTimelineFacts } from './storyService.js';
import {
    formatFactsForPrompt,
    queryRelevantFacts,
} from './sessionFactService.js';
import {
    formatRegionGraphSummary,
    resolveRegionContextForPrompt,
} from '../narration/regionContext.js';
import type { Character } from '../entities/Character.js';

const SNAPSHOT_TTL_SEC = Number(process.env.NARRATIVE_SNAPSHOT_TTL_SEC ?? 3600);
const REFRESH_EVERY_N = Math.max(
    1,
    Number(process.env.NARRATIVE_SNAPSHOT_EVERY_N_TURNS ?? 3),
);

export type NarrativeSnapshotPayload = {
    storySummary?: string;
    timelineFacts?: string;
    regionGraphSummary?: string;
    regionSlug?: string;
    staticMemoryBlock?: string;
    stateVersion: number;
    turnCounter: number;
    builtAt: string;
};

function snapshotKey(sessionId: number): string {
    return `session:${sessionId}:narrative_snapshot`;
}

function counterKey(sessionId: number): string {
    return `session:${sessionId}:narrative_turn_counter`;
}

export async function getNarrativeSnapshot(
    sessionId: number,
): Promise<NarrativeSnapshotPayload | null> {
    if (!redisClient?.isOpen) return null;
    try {
        const raw = await redisClient.get(snapshotKey(sessionId));
        if (!raw) return null;
        return JSON.parse(raw) as NarrativeSnapshotPayload;
    } catch {
        return null;
    }
}

async function saveNarrativeSnapshot(
    sessionId: number,
    payload: NarrativeSnapshotPayload,
): Promise<void> {
    if (!redisClient?.isOpen) return;
    await redisClient.set(snapshotKey(sessionId), JSON.stringify(payload), {
        EX: Number.isFinite(SNAPSHOT_TTL_SEC) ? SNAPSHOT_TTL_SEC : 3600,
    });
}

export async function bumpNarrativeTurnCounter(sessionId: number): Promise<number> {
    if (!redisClient?.isOpen) return 0;
    return redisClient.incr(counterKey(sessionId));
}

/** Reconstrói camadas estáticas (resumo, timeline, região) e grava no Redis. */
export async function refreshNarrativeSnapshot(params: {
    sessionId: number;
    character: Character | null;
    characterForAI: Record<string, unknown>;
    stateVersion: number;
    turnCounter?: number;
}): Promise<NarrativeSnapshotPayload | null> {
    const { sessionId, character, characterForAI, stateVersion, turnCounter } = params;

    const storySummary = (await getStorySummary(sessionId)) || undefined;
    const timelineFacts = (await buildTimelineFacts(sessionId)) || undefined;
    const regionContext = await resolveRegionContextForPrompt(character, characterForAI);
    const regionGraphSummary = regionContext ? formatRegionGraphSummary(regionContext) : undefined;

    const facts = await queryRelevantFacts(sessionId, {
        regionSlug: regionContext?.slug,
        limit: 8,
    });
    const factsBlock = formatFactsForPrompt(facts);

    const staticParts: string[] = [];
    if (storySummary) staticParts.push(`Resumo=${storySummary.slice(0, 400)}`);
    if (timelineFacts) staticParts.push(`Timeline=${timelineFacts.slice(0, 400)}`);
    if (factsBlock) staticParts.push(`Fatos conhecidos:\n${factsBlock}`);
    if (regionGraphSummary) staticParts.push(`Região=\n${regionGraphSummary.slice(0, 500)}`);

    const payload: NarrativeSnapshotPayload = {
        storySummary,
        timelineFacts,
        regionGraphSummary,
        regionSlug: regionContext?.slug,
        staticMemoryBlock: staticParts.length ? staticParts.join('\n\n') : undefined,
        stateVersion,
        turnCounter: params.turnCounter ?? 0,
        builtAt: new Date().toISOString(),
    };

    await saveNarrativeSnapshot(sessionId, payload);
    return payload;
}

/**
 * P4.5 — Atualiza snapshot a cada N turnos narrados; senão reutiliza cache no prompt.
 */
export async function refreshNarrativeSnapshotIfDue(params: {
    sessionId: number;
    character: Character | null;
    characterForAI: Record<string, unknown>;
    stateVersion: number;
}): Promise<void> {
    const turn = await bumpNarrativeTurnCounter(params.sessionId);
    if (turn % REFRESH_EVERY_N !== 0) {
        const existing = await getNarrativeSnapshot(params.sessionId);
        if (existing) return;
    }
    await refreshNarrativeSnapshot({ ...params, turnCounter: turn });
}

export function applySnapshotToMemoryLayers(
    snapshot: NarrativeSnapshotPayload | null,
    dynamicLayers: string[],
): string | undefined {
    const parts: string[] = [];
    if (snapshot?.staticMemoryBlock) parts.push(snapshot.staticMemoryBlock);
    parts.push(...dynamicLayers);
    return parts.length ? parts.join('\n\n') : undefined;
}
