import type { Character } from '../entities/Character.js';
import { getStorySummary, buildTimelineFacts } from '../services/storyService.js';
import { recallSimilarMemories } from '../services/vectorMemoryService.js';
import { isQdrantReady } from '../database/qdrant-client.js';
import {
    countActiveSessionFacts,
    embeddingPolicyNote,
    shouldEmbedForOperation,
} from '../services/embeddingPolicy.js';
import type { MemoryPayload } from '../schemas/vectorSchemas.js';
import { env } from '../config/env.js';
import {
    formatFactsForPrompt,
    queryRelevantFacts,
} from '../services/sessionFactService.js';
import {
    formatRegionGraphSummary,
    resolveRegionContextForPrompt,
    type RegionPromptContext,
} from './regionContext.js';
import {
    applySnapshotToMemoryLayers,
    getNarrativeSnapshot,
} from '../services/narrativeSnapshotService.js';

const MAX_MEMORY_LINES = 5;

const formatMemoriesForPrompt = (memories: MemoryPayload[]) => {
    if (!memories.length) return '';
    const lines = memories.slice(0, MAX_MEMORY_LINES).map(memory => {
        const when = memory.timestamp ? new Date(memory.timestamp).toISOString() : 'recente';
        const label = memory.name || memory.type || 'memória';
        const summary = memory.summary || memory.text || '';
        return `${when} | ${label}: ${summary}`;
    });
    return lines.join('\n');
};

export interface NarrationContextInput {
    sessionId: number;
    character: Character | null;
    characterForAI: Record<string, unknown>;
    playerAction: string;
    compactGameLog: string;
    apiKey: string;
    isTestRun: boolean;
    /** stateVersion antes do turno (política de embedding). */
    stateVersion?: number;
}

export interface NarrationContext {
    storySummary?: string;
    timelineFacts?: string;
    regionSlug?: string;
    regionGraphSummary?: string;
    discoveredRoutes?: RegionPromptContext['neighbors'];
    visitedRegions?: string[];
    layeredMemorySummary?: string;
    enrichedGameLog: string;
    regionContext: RegionPromptContext | null;
}

const collectNpcIds = (characterForAI: Record<string, unknown>): string[] => {
    const relationships = Array.isArray((characterForAI as any).relationships)
        ? (characterForAI as any).relationships
        : [];
    return relationships
        .map((rel: any) => rel?.npcId)
        .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0);
};

const collectQuestIds = (characterForAI: Record<string, unknown>): string[] => {
    const relationships = Array.isArray((characterForAI as any).relationships)
        ? (characterForAI as any).relationships
        : [];
    const ids: string[] = [];
    for (const rel of relationships) {
        for (const quest of rel?.quests ?? []) {
            if (quest?.id && quest.status !== 'completed') ids.push(quest.id);
        }
    }
    const journal = Array.isArray((characterForAI as any).journal) ? (characterForAI as any).journal : [];
    for (const entry of journal) {
        if (entry?.id && !entry.looted) ids.push(entry.id);
    }
    return ids;
};

/** Monta contexto em camadas para o prompt de IA (Fase 4.2). */
export async function buildNarrationContext(input: NarrationContextInput): Promise<NarrationContext> {
    const { sessionId, character, characterForAI, playerAction, compactGameLog, apiKey, isTestRun } = input;

    const snapshot = !isTestRun ? await getNarrativeSnapshot(sessionId) : null;

    let storySummary: string | undefined = snapshot?.storySummary;
    let timelineFacts: string | undefined = snapshot?.timelineFacts;
    if (!isTestRun && !storySummary) {
        storySummary = (await getStorySummary(sessionId)) || undefined;
    }
    if (!isTestRun && !timelineFacts) {
        timelineFacts = (await buildTimelineFacts(sessionId)) || undefined;
    }

    const regionContext = !isTestRun
        ? await resolveRegionContextForPrompt(character, characterForAI)
        : null;
    const regionGraphSummary =
        snapshot?.regionGraphSummary ??
        (regionContext ? formatRegionGraphSummary(regionContext) : undefined);

    const dynamicLayers: string[] = [];

    if (!snapshot?.staticMemoryBlock && !isTestRun) {
        const facts = await queryRelevantFacts(sessionId, {
            regionSlug: regionContext?.slug ?? snapshot?.regionSlug,
            npcIds: collectNpcIds(characterForAI),
            questIds: collectQuestIds(characterForAI),
            limit: 10,
        });
        const factsBlock = formatFactsForPrompt(facts);
        if (factsBlock) dynamicLayers.push(`Fatos conhecidos:\n${factsBlock}`);
    }

    if (!snapshot?.staticMemoryBlock) {
        if (storySummary) dynamicLayers.unshift(`Resumo=${storySummary.slice(0, 400)}`);
        if (timelineFacts) dynamicLayers.unshift(`Timeline=${timelineFacts.slice(0, 400)}`);
    }

    if (!isTestRun) {
        try {
            const stateVersion = input.stateVersion ?? 0;
            const activeFactCount = await countActiveSessionFacts(sessionId);
            const semanticRecall = shouldEmbedForOperation('recall', stateVersion, activeFactCount);
            const policyNote = embeddingPolicyNote('recall', stateVersion, activeFactCount);

            const memories = await recallSimilarMemories(
                'session_memories',
                `${playerAction}\n${compactGameLog}`,
                {
                    apiKey,
                    limit: 5,
                    filter: { sessionId: String(sessionId) },
                    semanticSearch: semanticRecall,
                },
            );
            const recallBlock = formatMemoriesForPrompt(memories);
            if (recallBlock) {
                dynamicLayers.push(
                    `${env.QDRANT_ENABLED && isQdrantReady() && semanticRecall ? 'Recall vetorial (Qdrant)' : 'Memórias (backlog/SQL)'}:\n${recallBlock}`,
                );
            } else if (policyNote) {
                dynamicLayers.push(policyNote);
            }
        } catch (error) {
            console.error('[contextBuilder] Falha no recall de memórias:', error);
        }
    }

    const layeredMemorySummary = applySnapshotToMemoryLayers(snapshot, dynamicLayers);
    const enrichedGameLog = layeredMemorySummary
        ? `${compactGameLog}\n\nMEMORIA_CAMADAS=\n${layeredMemorySummary}`
        : compactGameLog;

    return {
        storySummary,
        timelineFacts,
        regionSlug: regionContext?.slug,
        regionGraphSummary,
        discoveredRoutes: regionContext?.discoveredRoutes,
        visitedRegions: regionContext?.visitedRegions,
        layeredMemorySummary,
        enrichedGameLog,
        regionContext,
    };
}
