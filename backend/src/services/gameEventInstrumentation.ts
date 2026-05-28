import { recordGameEvent } from '../events/recordGameEvent.js';
import type { GameEventType } from '../events/types.js';

/** P0.1.2 — helpers de instrumentação (fire-and-forget). */
export function instrumentGameEvent(
    sessionId: number,
    type: GameEventType,
    fields: {
        actionId?: string | null;
        stateVersion?: number | null;
        characterId?: number | null;
        payload?: Record<string, unknown>;
    } = {},
): void {
    void recordGameEvent({
        sessionId,
        type,
        actionId: fields.actionId ?? null,
        stateVersion: fields.stateVersion ?? null,
        characterId: fields.characterId ?? null,
        payload: fields.payload,
    }).catch(() => undefined);
}
