import { advanceActiveQuests } from '../../sessionQuests.js';

export async function runQuestTick(sessionId: number): Promise<string[]> {
    return advanceActiveQuests(sessionId);
}
