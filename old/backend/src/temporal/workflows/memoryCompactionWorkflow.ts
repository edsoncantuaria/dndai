import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities/memoryCompactionActivity.js';

const { compactSessionMemory } = proxyActivities<typeof activities>({
    startToCloseTimeout: '5 minutes',
});

export type MemoryCompactionInput = {
    sessionId: number;
    fromActionSequence: number;
    toActionSequence: number;
};

export async function memoryCompactionWorkflow(input: MemoryCompactionInput): Promise<string> {
    return compactSessionMemory(input);
}
