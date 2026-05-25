import type { GameMasterFlowInput, GameMasterResponse } from '../schemas/gameSchemas.js';
import { getGameUpdate, type GameUpdateWarning } from '../ai/gameUpdate.js';
import { runOssNarration, ensureOssModel } from '../ai-oss/orchestration/narrationPipeline.js';
import { isOssEngineEnabled } from '../ai-oss/core/engineSwitch.js';
import { validateByPhaseFocus } from '../ai/responseValidator.js';
import { generateFallbackResponse } from '../services/gameOrchestrator.js';
import type { GenerationConfig } from '../schemas/validationSchemas.js';
import { resolvePipelineMode, type AiPipelineMode } from '../ai/constants.js';
import { recordAiPipelineMetric } from '../ai/metrics.js';

export type ResponseFocusMode = 'narrative';

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
    pipelineMode?: AiPipelineMode;
    actionId?: string;
    stateVersion?: number;
}

async function requestPhaseResponse(
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
        const flowInput: GameMasterFlowInput = {
            ...ctx.baseInput,
            ...extraInput,
            suppressRollRequest,
            responseFocus: 'narrative',
            validationFeedback,
        };
        const model = ensureOssModel(ctx.modelToUse);
        const { response: candidate, rawText: currentRaw, warnings: callWarnings = [] } =
            isOssEngineEnabled()
                ? await runOssNarration({
                      input: flowInput,
                      apiKey: ctx.apiKey,
                      model,
                      generationConfig: ctx.generationConfig,
                      actionId: ctx.actionId,
                      traceId: ctx.actionId,
                      stateVersion: ctx.stateVersion,
                  })
                : await getGameUpdate(
                      flowInput,
                      model,
                      ctx.generationConfig,
                      ctx.apiKey,
                  );
        lastWarnings = callWarnings;

        rawText = currentRaw;
        const validation = validateByPhaseFocus(candidate, 'narrative');
        if (validation.valid) {
            finalFromModel = candidate;
            latestIssues = [];
            void recordAiPipelineMetric({
                sessionId: ctx.sessionId,
                phase: 'narrative',
                success: true,
                attempts: calls,
                latencyMs: Date.now() - phaseStarted,
            });
            break;
        }

        latestIssues = validation.issues;
        retryCount += 1;
        validationFeedback = `Corrija o JSON narrativo. Problemas: ${validation.issues.join('; ')}`;
        void recordAiPipelineMetric({
            sessionId: ctx.sessionId,
            phase: 'narrative',
            success: false,
            attempts: calls,
            latencyMs: Date.now() - phaseStarted,
        });
    }

    if (!finalFromModel) {
        usedFallback = true;
        finalFromModel = generateFallbackResponse(
            { character: ctx.characterForAI },
            ctx.playerAction,
            latestIssues,
        );
    }

    return {
        response: finalFromModel,
        rawText,
        validationIssues: latestIssues,
        attempts: calls,
        retryCount,
        usedFallback,
        focus: 'narrative',
        warnings: lastWarnings,
        suppressRollRequest,
        latencyMs: Date.now() - started,
    };
}

export interface OrchestratedPhases {
    pipelineMode: AiPipelineMode;
    narrativePhase: PhaseResult;
    statePhase: null;
    mergedResponse: GameMasterResponse;
}

/** Orquestra fase narrativa única (motor detém estado). */
export async function runAiPhases(ctx: PhaseOrchestratorInput): Promise<OrchestratedPhases> {
    const pipelineMode = resolvePipelineMode();

    const narrativePhase = await requestPhaseResponse(
        ctx,
        ctx.narrativeHint ? { validationFeedback: ctx.narrativeHint } : {},
    );

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

/** Alias usado por narrarService. */
export const runNarrationAiPhases = runAiPhases;
