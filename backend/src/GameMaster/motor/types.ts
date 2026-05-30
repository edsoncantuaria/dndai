import type { RuleCheckResult } from '../../rules/types.js';
import type { PlayerRollRequest } from '../../types.js';
import type { TravelIntentPenai } from '../world/travelCanon.js';

export type ActionIntent =
    | { type: 'travel'; payload: TravelIntentPenai }
    | { type: 'combat'; payload: Record<string, unknown> }
    | { type: 'social'; payload: Record<string, unknown> }
    | { type: 'free'; payload: Record<string, unknown> };

export type MotorInput = {
    sessionId: number;
    userId: number;
    playerAction: string;
    actionId: string;
    actionSequence: number;
    payload?: Record<string, unknown>;
};

export type MotorResult = {
    intent: ActionIntent;
    ruleCheck: RuleCheckResult;
    mechanical: Record<string, unknown>;
    blocked: boolean;
    awaitingRoll: boolean;
    playerRollRequest?: PlayerRollRequest;
};

export type RollSubmitInput = {
    sessionId: number;
    userId: number;
    requestId: string;
    rolls: number[];
    rawRoll?: number;
    actionId?: string;
    actionSequence?: number;
};

export type RollResolveResult = {
    ok: boolean;
    message?: string;
    rollSummary?: string;
    playerAction?: string;
    actionId?: string;
    actionSequence?: number;
    ruleCheck?: RuleCheckResult;
    mechanical?: Record<string, unknown>;
    deferNarration?: boolean;
    playerRollRequest?: PlayerRollRequest;
};

/** @deprecated use ActionIntent */
export type PenaiActionIntent = ActionIntent;
/** @deprecated use MotorInput */
export type PenaiMotorInput = MotorInput;
/** @deprecated use MotorResult */
export type PenaiMotorResult = MotorResult;
/** @deprecated use RollSubmitInput */
export type PenaiRollSubmitInput = RollSubmitInput;
/** @deprecated use RollResolveResult */
export type PenaiRollResolveResult = RollResolveResult;
