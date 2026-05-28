import { isStaleNarrationSequence } from '../services/actionSequenceService.js';
import { logPipelineTrace } from '../telemetry/pipelineTrace.js';

/** Origem da execução de `processPlayerTurn` / `persistNarrationTurn`. */
export type NarrationExecutionSource = 'sync' | 'worker';

/** P5.2 — worker não persiste mecânica autoritativa (combate/ficha); só hot path síncrono. */
export function shouldSkipMechanicalPersistence(
    motorOwnsState: boolean,
    source: NarrationExecutionSource,
): boolean {
    return motorOwnsState && source === 'worker';
}

/** P5.2.1 — aborta persistência se uma ação mais nova já foi enfileirada. */
export async function isStaleBeforePersist(
    sessionId: number,
    actionSequence: number | null | undefined,
): Promise<boolean> {
    if (actionSequence == null || !Number.isFinite(actionSequence)) return false;
    return isStaleNarrationSequence(sessionId, actionSequence);
}

export async function logStalePersistAbort(params: {
    sessionId: number;
    actionId?: string | null;
    actionSequence?: number | null;
    stage: string;
}): Promise<void> {
    logPipelineTrace('narration:persist:stale_abort', {
        sessionId: params.sessionId,
        actionId: params.actionId ?? undefined,
        actionSequence: params.actionSequence ?? null,
        stage: params.stage,
    });
}
