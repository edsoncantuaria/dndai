import type { RuleCheckResult } from '../../rules/types.js';
import type { PlayerRollRequest } from '../../types.js';
import type { TravelIntentPenai } from '../world/travelCanon.js';

export type PenaiActionIntent =
    | { type: 'travel'; payload: TravelIntentPenai }
    | { type: 'combat'; payload: Record<string, unknown> }
    | { type: 'social'; payload: Record<string, unknown> }
    | { type: 'free'; payload: Record<string, unknown> };

export type PenaiMotorInput = {
    sessionId: number;
    userId: number;
    playerAction: string;
    actionId: string;
    actionSequence: number;
    payload?: Record<string, unknown>;
};

export type PenaiMotorResult = {
    intent: PenaiActionIntent;
    ruleCheck: RuleCheckResult;
    mechanical: Record<string, unknown>;
    blocked: boolean;
    /** Se true, não enfileirar narração até submitRollResult */
    awaitingRoll: boolean;
    playerRollRequest?: PlayerRollRequest;
};

export type PenaiRollSubmitInput = {
    sessionId: number;
    userId: number;
    requestId: string;
    rolls: number[];
    rawRoll?: number;
    actionId?: string;
    actionSequence?: number;
};

export type PenaiRollResolveResult = {
    ok: boolean;
    message?: string;
    rollSummary?: string;
    playerAction?: string;
    actionId?: string;
    actionSequence?: number;
    ruleCheck?: RuleCheckResult;
    mechanical?: Record<string, unknown>;
    /** Se true, wsHandlers não deve enfileirar narração (chain attack→damage). */
    deferNarration?: boolean;
    playerRollRequest?: PlayerRollRequest;
};
