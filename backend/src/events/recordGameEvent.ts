import { recordActionLog } from '../services/actionLogService.js';
import type { ActionLog } from '../entities/ActionLog.js';
import { gameEventActionType, type RecordGameEventInput } from './types.js';

/** Append-only game events (projeção em action_logs até tabela dedicada). */
export async function recordGameEvent(input: RecordGameEventInput): Promise<ActionLog> {
    return recordActionLog({
        sessionId: input.sessionId,
        actionId: input.actionId ?? undefined,
        actionType: gameEventActionType(input.type),
        stateVersion: input.stateVersion ?? undefined,
        characterId: input.characterId ?? undefined,
        encounterId: input.encounterId ?? undefined,
        metadata: {
            eventType: input.type,
            ...(input.payload ?? {}),
        },
    });
}
