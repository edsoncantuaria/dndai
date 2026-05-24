import type { GameMasterResponse } from '../schemas/gameSchemas.js';
import type { AiPipelineMode } from '../ai/constants.js';

/** Campos que pertencem ao motor — a IA não deve persistir ou reconciliar. */
export const MOTOR_OWNED_RESPONSE_FIELDS = [
    'updatedCharacter',
    'worldState',
    'combatState',
    'playerRollRequest',
    'xpEvents',
    'progressionFeed',
    'newHomebrewContent',
    'levelUpState',
    'shopState',
    'lootOffer',
    'useHitDiceRequest',
    'gameClock',
] as const;

export function isMotorOwnedPipeline(mode: AiPipelineMode): boolean {
    return mode === 'narration_only';
}

/** Remove campos de estado que a IA não deve controlar (modo narration_only). */
export function stripMotorOwnedFields(response: GameMasterResponse): GameMasterResponse {
    const cleaned: GameMasterResponse = {
        logEntries: response.logEntries ?? [],
        actionOptions: response.actionOptions ?? [],
    };
    if (response.systemLog !== undefined) {
        cleaned.systemLog = response.systemLog;
    }
    if (response.memoryContext !== undefined) {
        cleaned.memoryContext = response.memoryContext;
    }
    return cleaned;
}
