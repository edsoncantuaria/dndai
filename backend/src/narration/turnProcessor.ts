import type { GameMasterFlowInput, GameMasterResponse } from '../schemas/gameSchemas.js';
import { buildFeedbackHint } from '../services/aiFeedbackService.js';
import { runAiPhases, type OrchestratedPhases } from './phaseOrchestrator.js';
import type { GenerationConfig } from '../schemas/validationSchemas.js';
import { resolvePipelineMode } from '../ai/constants.js';

export type RunNarrationAiPhasesParams = {
    baseInput: GameMasterFlowInput;
    playerAction: string;
    characterForAI: Record<string, unknown>;
    modelToUse: string;
    generationConfig: GenerationConfig;
    apiKey: string;
    sessionId: string;
    scenarioLabel?: string;
    actionId?: string;
    stateVersion?: number;
};

/** Orquestra fases narrativa + estado (Gemini) — extraído do miolo de processPlayerTurn. */
export async function runNarrationAiPhases(
    params: RunNarrationAiPhasesParams,
): Promise<OrchestratedPhases> {
    const {
        baseInput,
        playerAction,
        characterForAI,
        modelToUse,
        generationConfig,
        apiKey,
        sessionId,
        scenarioLabel,
        actionId,
        stateVersion,
    } = params;

    const narrativeHint = await buildFeedbackHint(sessionId, scenarioLabel, 'narrative');
    const stateHint = await buildFeedbackHint(sessionId, scenarioLabel, 'state');

    return runAiPhases({
        baseInput,
        playerAction,
        characterForAI,
        modelToUse,
        generationConfig,
        apiKey,
        sessionId,
        narrativeHint: narrativeHint ?? undefined,
        stateHint: stateHint ?? undefined,
        pipelineMode: resolvePipelineMode(),
        actionId,
        stateVersion,
    });
}
