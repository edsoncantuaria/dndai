import { dispatchNarrationToQueue, buildQueuedNarrationAck } from '../queue/narrationDispatch.js';
import { isNarrationQueueAvailable } from '../queue/narrationJobQueue.js';
import { getLatestActionSequence } from './actionSequenceService.js';
import type { GameMasterResponse } from '../schemas/gameSchemas.js';

export type RestNarrationEnqueueInput = {
    sessionId: number;
    userId: number;
    actionId: string;
    playerAction: string;
    apiKey: string;
    combatState?: unknown;
    useAiHomebrew?: boolean;
    stateVersion?: number;
    narrationVoice?: string;
    narrationSpeed?: string;
};

export type RestNarrationEnqueueResult =
    | { mode: 'queued'; actionSequence: number; ack: GameMasterResponse }
    | { mode: 'sync' };

/** P4.8 — REST usa a mesma fila BullMQ que o WebSocket quando Redis está disponível. */
export async function tryEnqueueRestNarration(
    input: RestNarrationEnqueueInput,
): Promise<RestNarrationEnqueueResult> {
    if (!isNarrationQueueAvailable() || !input.apiKey?.trim()) {
        return { mode: 'sync' };
    }

    const queued = await dispatchNarrationToQueue({
        sessionId: input.sessionId,
        userId: input.userId,
        actionId: input.actionId,
        stateVersion: input.stateVersion,
        job: {
            kind: 'action',
            playerAction: input.playerAction,
            apiKey: input.apiKey,
            combatState: input.combatState,
            useAiHomebrew: input.useAiHomebrew,
            narrationVoice: input.narrationVoice,
            narrationSpeed: input.narrationSpeed,
        },
    });

    if (!queued) return { mode: 'sync' };

    const actionSequence = await getLatestActionSequence(input.sessionId);
    return { mode: 'queued', actionSequence, ack: buildQueuedNarrationAck() };
}

export function buildRestQueuedHttpPayload(
    actionId: string,
    stateVersion: number,
    actionSequence: number,
    mechanical?: Record<string, unknown>,
): {
    actionResolution: Record<string, unknown>;
    gameStateUpdate: Record<string, unknown>;
} {
    return {
        actionResolution: {
            actionId,
            stateVersion,
            status: 'narration_queued',
            actionSequence,
        },
        gameStateUpdate: {
            stateVersion,
            actionSequence,
            systemLog: '[pipeline:narration-queued]',
            ...mechanical,
        },
    };
}
