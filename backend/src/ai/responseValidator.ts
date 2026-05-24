import {
    GameMasterResponseSchema,
    NarrativePhaseResponseSchema,
    StatePhaseResponseSchema,
    type GameMasterFlowInput,
    type GameMasterResponse,
} from '../schemas/gameSchemas.js';
import { sanitizeGameMasterResponse } from '../services/aiSanitizer.js';

export type PhaseFocus = 'full' | 'narrative' | 'state';

export interface PhaseValidationResult {
    valid: boolean;
    data?: GameMasterResponse;
    issues: string[];
}

export function validateByPhaseFocus(
    response: unknown,
    focus: PhaseFocus,
): PhaseValidationResult {
    if (focus === 'narrative') {
        const check = NarrativePhaseResponseSchema.safeParse(response);
        if (!check.success) {
            return {
                valid: false,
                issues: check.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
            };
        }
        return { valid: true, data: response as GameMasterResponse, issues: [] };
    }

    if (focus === 'state') {
        const check = StatePhaseResponseSchema.safeParse(response);
        if (!check.success) {
            return {
                valid: false,
                issues: check.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
            };
        }
        return { valid: true, data: response as GameMasterResponse, issues: [] };
    }

    const check = GameMasterResponseSchema.safeParse(response);
    if (!check.success) {
        return {
            valid: false,
            issues: check.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
        };
    }
    return { valid: true, data: check.data, issues: [] };
}

export function sanitizeForPipeline(
    response: GameMasterResponse,
    input: GameMasterFlowInput,
): GameMasterResponse {
    return sanitizeGameMasterResponse(response, input.character, input);
}
