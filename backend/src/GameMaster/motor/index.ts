/**
 * PENAI_MOTOR — motor determinístico do path Fastify/Postgres.
 */
export { classifyPenaiIntent } from './classifyIntent.js';
export { validateAndApply } from './validateAndApply.js';
export { validateActionSense } from './actionSense.js';
export { resolvePenaiRoll } from './rollPipeline.js';
export { isPenaiTurnLocked, completePenaiTurnNarration } from './turnLock.js';
export { loadPenaiCharacterSnapshot } from './penaiCharacterSnapshot.js';
export type {
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

export const PENAI_MOTOR = {
    classifyIntent: classifyPenaiIntent,
    validateActionSense,
    validateAndApply,
    resolveRoll: resolvePenaiRoll,
    isTurnLocked: isPenaiTurnLocked,
    completeNarration: completePenaiTurnNarration,
} as const;
