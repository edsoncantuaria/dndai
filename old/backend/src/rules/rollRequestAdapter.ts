// backend/src/rules/rollRequestAdapter.ts
import type { RollRequest } from './types.js';
import type { PlayerRollRequest } from '../types.js';

const ROLL_FORMULA_REGEX = /^(\d+d\d+)([+-]\d+)?$/i;

export function convertRollRequestToPlayerRoll(
    request: RollRequest,
    overrides: {
        rollType: PlayerRollRequest['rollType'];
        reasonPrefix?: string;
        metadata?: Record<string, unknown>;
    }
): PlayerRollRequest {
    const match = request.formula.match(ROLL_FORMULA_REGEX);
    const dice = match?.[1] ?? '1d20';
    const modifier = match?.[2] ? Number(match[2]) : 0;
    const reason = overrides.reasonPrefix
        ? `${overrides.reasonPrefix} - ${request.context}`
        : request.context;

    return {
        reason,
        dice,
        modifier,
        dc: request.targetDc,
        rollType: overrides.rollType,
        advantage: request.advantage,
        disadvantage: request.disadvantage,
        details: request.modifierBreakdown ?? [],
        metadata: overrides.metadata ?? request.metadata,
    };
}
