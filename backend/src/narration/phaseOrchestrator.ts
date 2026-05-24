import type { GameMasterFlowInput, GameMasterResponse } from '../schemas/gameSchemas.js';
import { getGameUpdate, type GameUpdateWarning } from '../services/aiService.js';
import { validateGameMasterResponse } from '../services/gameResponseValidator.js';
import { validateByPhaseFocus } from '../ai/responseValidator.js';
import { generateFallbackResponse } from '../services/gameOrchestrator.js';
import type { GenerationConfig } from '../schemas/validationSchemas.js';
import { resolvePipelineMode, type AiPipelineMode } from '../ai/constants.js';
import { recordAiPipelineMetric } from '../ai/metrics.js';

export type ResponseFocusMode = 'full' | 'narrative' | 'state';

export interface PhaseResult {
    response: GameMasterResponse;
    rawText: string | null;
    validationIssues: string[];
    attempts: number;
    retryCount: number;
    usedFallback: boolean;
    focus: ResponseFocusMode;
    warnings: GameUpdateWarning[];
    suppressRollRequest: boolean;
    latencyMs: number;
}

export interface PhaseOrchestratorInput {
    baseInput: GameMasterFlowInput;
    playerAction: string;
    characterForAI: Record<string, unknown>;
    modelToUse: string;
    generationConfig: GenerationConfig;
    apiKey: string;
    sessionId?: string;
    narrativeHint?: string;
    stateHint?: string;
    pipelineMode?: AiPipelineMode;
}

async function requestPhaseResponse(
    focus: ResponseFocusMode,
    ctx: PhaseOrchestratorInput,
    extraInput: Partial<GameMasterFlowInput> = {},
): Promise<PhaseResult> {
    const MAX_VALIDATION_ATTEMPTS = 3;
    let retryCount = 0;
    let calls = 0;
    let validationFeedback: string | undefined = extraInput.validationFeedback;
    let latestIssues: string[] = [];
    let rawText: string | null = null;
    let finalFromModel: GameMasterResponse | null = null;
    let usedFallback = false;
    let lastWarnings: GameUpdateWarning[] = [];
    const started = Date.now();

    const suppressRollRequest =
        extraInput.suppressRollRequest ?? ctx.baseInput.suppressRollRequest ?? false;

    while (retryCount < MAX_VALIDATION_ATTEMPTS) {
        calls += 1;
        const phaseStarted = Date.now();
        const { response: candidate, rawText: currentRaw, warnings: callWarnings = [] } = await getGameUpdate(
            {
                ...ctx.baseInput,
                ...extraInput,
                suppressRollRequest,
                responseFocus: focus,
                validationFeedback,
            },
            ctx.modelToUse,
            ctx.generationConfig,
            ctx.apiKey,
        );
        lastWarnings = callWarnings;

        rawText = currentRaw;
        const validation = validateByPhaseFocus(candidate, focus);
        if (validation.valid) {
            finalFromModel = candidate;
            latestIssues = [];
            void recordAiPipelineMetric({
                sessionId: ctx.sessionId,
                phase: focus === 'full' ? 'full' : focus,
                model: ctx.modelToUse,
                latencyMs: Date.now() - phaseStarted,
                retryCount,
                success: true,
            });
            break;
        }

        latestIssues = validation.issues;
        validationFeedback = `Inconsistências: ${validation.issues.join('; ')}. Corrija e retorne JSON válido para a fase ${focus}.`;
        retryCount += 1;
    }

    if (!finalFromModel) {
        finalFromModel = generateFallbackResponse({ character: ctx.characterForAI }, ctx.playerAction, latestIssues);
        usedFallback = true;
        void recordAiPipelineMetric({
            sessionId: ctx.sessionId,
            phase: focus === 'full' ? 'full' : focus,
            model: ctx.modelToUse,
            latencyMs: Date.now() - started,
            retryCount,
            usedFallback: true,
            success: false,
        });
    }

    return {
        response: finalFromModel,
        rawText,
        validationIssues: latestIssues,
        attempts: calls,
        retryCount,
        usedFallback,
        focus,
        warnings: lastWarnings,
        suppressRollRequest,
        latencyMs: Date.now() - started,
    };
}

export interface OrchestratedPhases {
    pipelineMode: AiPipelineMode;
    narrativePhase: PhaseResult;
    statePhase: PhaseResult | null;
    mergedResponse: GameMasterResponse;
}

/** Orquestra fases de IA conforme AI_PIPELINE_MODE. */
export async function runAiPhases(ctx: PhaseOrchestratorInput): Promise<OrchestratedPhases> {
    const pipelineMode = ctx.pipelineMode ?? resolvePipelineMode();

    const narrativePhase = await requestPhaseResponse(
        'narrative',
        ctx,
        ctx.narrativeHint ? { validationFeedback: ctx.narrativeHint } : {},
    );

    if (pipelineMode === 'narration_only') {
        const merged: GameMasterResponse = {
            logEntries: narrativePhase.response.logEntries ?? [],
            actionOptions: narrativePhase.response.actionOptions ?? [],
            systemLog: narrativePhase.response.systemLog,
            memoryContext: narrativePhase.response.memoryContext,
        };
        return {
            pipelineMode,
            narrativePhase,
            statePhase: null,
            mergedResponse: merged,
        };
    }

    const statePhase = await requestPhaseResponse(
        'state',
        ctx,
        ctx.stateHint ? { validationFeedback: ctx.stateHint } : {},
    );

    const mergedResponse: GameMasterResponse = {
        ...statePhase.response,
        logEntries: narrativePhase.response.logEntries ?? [],
        actionOptions: narrativePhase.response.actionOptions ?? [],
    };

    return {
        pipelineMode,
        narrativePhase,
        statePhase,
        mergedResponse,
    };
}
