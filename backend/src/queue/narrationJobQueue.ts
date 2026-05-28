import type { PlayerRollRequest } from '../types.js';
import type { RollResolutionResult } from '../services/ruleResolutionService.js';
import { enqueueNarrationJobBull } from './narrationBullQueue.js';
import redisClient from '../database/redis-client.js';

export type NarrationJobPayload = {
    kind: 'action' | 'roll';
    sessionId: number;
    userId: number;
    actionId: string;
    /** P4.1 — ordenação; jobs com sequence < latest são descartados no worker. */
    actionSequence?: number;
    playerAction: string;
    apiKey: string;
    useAiHomebrew?: boolean;
    narrationVoice?: string;
    narrationSpeed?: string;
    combatState?: unknown;
    pending?: PlayerRollRequest & { requestId: string; userId: number };
    diceValues?: number[];
    resolutionResult?: RollResolutionResult | null;
    rollTotal?: number;
};

export function isNarrationQueueAvailable(): boolean {
    return Boolean(redisClient?.isOpen);
}

export function parseNarrationJob(raw: string): NarrationJobPayload | null {
    try {
        const parsed = JSON.parse(raw) as NarrationJobPayload;
        if (!parsed?.sessionId || !parsed?.userId || !parsed?.actionId || !parsed?.apiKey) return null;
        return parsed;
    } catch {
        return null;
    }
}

/** Enfileira narração no BullMQ (Redis). Retorna false só sem Redis (ex.: testes mock). */
export async function enqueueNarrationJob(job: NarrationJobPayload): Promise<boolean> {
    if (!isNarrationQueueAvailable()) return false;
    return enqueueNarrationJobBull({ kind: job.kind ?? 'action', ...job });
}
