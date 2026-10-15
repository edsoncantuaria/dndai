/**
 * GAME_MOTOR — motor determinístico do path Fastify/Postgres.
 * @deprecated PENAI_MOTOR — use GAME_MOTOR
 */
export { classifyPenaiIntent, classifyPenaiIntent as classifyIntent } from './classifyIntent.js';
export { validateAndApply } from './validateAndApply.js';
export { validateActionSense } from './actionSense.js';
export { resolvePenaiRoll, resolvePenaiRoll as resolveRoll } from './rollPipeline.js';
export {
    isPenaiTurnLocked,
    isPenaiTurnLocked as isTurnLocked,
    completePenaiTurnNarration,
    completePenaiTurnNarration as completeNarration,
} from './turnLock.js';
export {
    loadPenaiCharacterSnapshot,
    loadPenaiCharacterSnapshot as loadCharacterSnapshot,
} from './characterSnapshot.js';
export type {
    ActionIntent,
    MotorInput,
    MotorResult,
    RollSubmitInput,
    RollResolveResult,
    PenaiActionIntent,
    PenaiMotorInput,
    PenaiMotorResult,
    PenaiRollSubmitInput,
    PenaiRollResolveResult,
} from './types.js';

import { validateAndApply } from './validateAndApply.js';
import { validateActionSense } from './actionSense.js';
import { resolvePenaiRoll } from './rollPipeline.js';
import { isPenaiTurnLocked, completePenaiTurnNarration } from './turnLock.js';
import { classifyPenaiIntent } from './classifyIntent.js';

export const GAME_MOTOR = {
    classifyIntent: classifyPenaiIntent,
    validateActionSense,
    validateAndApply,
    resolveRoll: resolvePenaiRoll,
    isTurnLocked: isPenaiTurnLocked,
    completeNarration: completePenaiTurnNarration,
} as const;

/** @deprecated use GAME_MOTOR */
export const PENAI_MOTOR = GAME_MOTOR;
