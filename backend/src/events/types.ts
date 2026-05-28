/**
 * Eventos append-only do turno de jogo (auditoria / replay / debug).
 * Persistidos via action_logs com prefixo game_event:
 */

export const GAME_EVENT_PREFIX = 'game_event:';

export type GameEventType =
    | 'IntentReceived'
    | 'IntentValidated'
    | 'RollIssued'
    | 'RollResolved'
    | 'DeltaApplied'
    | 'MechanicalUpdateEmitted'
    | 'StateVersionBumped'
    | 'NarrationRequested'
    | 'NarrationCompleted'
    | 'NarrationSkipped'
    | 'NarrationCancelled'
    | 'NarrationFailed'
    | 'ProcessActionFailed';

export type RecordGameEventInput = {
    sessionId: number;
    actionId?: string | null;
    type: GameEventType;
    stateVersion?: number | null;
    characterId?: number | null;
    encounterId?: number | null;
    payload?: Record<string, unknown>;
};

export function gameEventActionType(type: GameEventType): string {
    return `${GAME_EVENT_PREFIX}${type}`;
}
