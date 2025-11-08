// backend/src/services/worldBuilderService.ts
import { storeMemory, recallSimilarMemories } from './vectorMemoryService.js';
import type { MemoryPayload } from '../schemas/vectorSchemas.js';

interface RegionMemoryInput {
    nodeId: string;
    regionName: string;
    description: string;
    apiKey: string;
}

export const recordRegionLore = async ({ nodeId, regionName, description, apiKey }: RegionMemoryInput) => {
    if (!apiKey?.trim()) return;
    await storeMemory(
        'world_memories',
        description,
        {
            id: `${nodeId}-${Date.now()}`,
            nodeId,
            type: 'region',
            name: regionName,
            timestamp: Date.now(),
            summary: regionName,
        },
        apiKey,
    );
};

export const recallWorldLore = async (
    prompt: string,
    apiKey: string,
    limit = 8,
    nodeId?: string,
): Promise<MemoryPayload[]> => {
    if (!apiKey?.trim()) return [];
    const filter = nodeId ? { nodeId } : undefined;
    return recallSimilarMemories('world_memories', prompt, {
        apiKey,
        limit,
        filter,
    });
};
