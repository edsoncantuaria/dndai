// backend/src/services/storyDirector.ts
import { storeMemory, recallSimilarMemories } from './vectorMemoryService.js';
import type { MemoryPayload } from '../schemas/vectorSchemas.js';

export const recordNarrativeBeat = async (
    sessionId: number,
    description: string,
    extras: Partial<MemoryPayload> = {},
    apiKey?: string,
) => {
    if (!apiKey?.trim()) return;
    await storeMemory(
        'session_memories',
        description,
        {
            sessionId: String(sessionId),
            type: extras.type ?? 'narration',
            timestamp: extras.timestamp ?? Date.now(),
            summary: extras.summary,
        },
        apiKey,
    );
};

export const recallNarrativeContext = async (
    sessionId: number,
    query: string,
    limit = 5,
    apiKey?: string,
) => {
    if (!apiKey?.trim()) return [];
    return recallSimilarMemories('session_memories', query, {
        apiKey,
        limit,
        filter: { sessionId: String(sessionId) },
    });
};
