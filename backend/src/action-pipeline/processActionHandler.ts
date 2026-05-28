import createError from 'http-errors';
import { v4 as uuidv4 } from 'uuid';
import { getPendingRollRequest } from '../services/rollRequestService.js';
import type { ActionIntent } from '../rules/actionIntentService.js';
import { hasResolvableOpenRouterKey } from '../ai-oss/core/apiKeyResolve.js';
import { isOssStreamEnabled } from '../ai-oss/core/streamSwitch.js';
import {
    clearNarrationStreamSink,
    registerNarrationStreamSink,
} from '../ai-oss/orchestration/narrationStream.js';
import {
    computeIntentHash,
    registerActionIntentTelemetry,
    clearActionTelemetry,
    markActionPhaseTelemetry,
} from '../services/actionObservabilityService.js';
import {
    ProcessActionSchema,
    isContractVersionSupported,
    CURRENT_CONTRACT_VERSION,
} from '../schemas/processActionSchema.js';
import { beginActionPhase, advanceActionPhase, clearActionPhase, type ActionPhase } from '../services/actionPhaseService.js';
import { instrumentGameEvent } from '../services/gameEventInstrumentation.js';
import type { ActionPipelineWs } from './types.js';
import {
    bumpSessionStateVersion,
    cancelledActions,
    emitActionRelease,
    getSessionStateVersion,
    hasCachedSessionStateVersion,
    loadSessionStateVersion,
    logActionFlow,
    setSessionStateVersion,
} from './context.js';
import { handleStructuredIntent } from './structuredIntentHandler.js';

export type ProcessActionHandlerOptions = {
    activeActions: Set<string>;
};

export async function handleProcessAction(
    ws: ActionPipelineWs,
    rawPayload: unknown,
    options: ProcessActionHandlerOptions,
): Promise<void> {
    if (!ws.userId) return;

    const validation = ProcessActionSchema.safeParse(rawPayload);
    if (!validation.success) {
        console.warn('[WSS] processAction payload inválido', validation.error.flatten());
        ws.send(
            JSON.stringify({
                type: 'error',
                payload: {
                    code: 'INVALID_PAYLOAD',
                    message: 'Payload inválido para processAction.',
                    details: validation.error.flatten(),
                },
            }),
        );
        return;
    }
    const processPayload = validation.data;
    if (!isContractVersionSupported(processPayload.contractVersion)) {
        ws.send(
            JSON.stringify({
                type: 'error',
                payload: {
                    code: 'CONTRACT_VERSION_MISMATCH',
                    message: `Atualize o cliente para contractVersion ${CURRENT_CONTRACT_VERSION}.`,
                },
            }),
        );
        return;
    }
    if (!processPayload.sessionId) {
        ws.send(
            JSON.stringify({
                type: 'error',
                payload: {
                    code: 'INVALID_SESSION',
                    message: 'sessionId é obrigatório neste contrato.',
                },
            }),
        );
        return;
    }

    let resolvedActionId: string | undefined;
    let currentSessionId: number | undefined;
    let phaseLockAcquired = false;
    let unregisterStream: (() => void) | undefined;
    const recordPhase = async (phase: ActionPhase) => {
        if (!ws.userId || !currentSessionId || !resolvedActionId) return;
        if (phase === 'RECEIVED') {
            await beginActionPhase({
                sessionId: currentSessionId,
                userId: ws.userId,
                actionId: resolvedActionId,
            });
            phaseLockAcquired = true;
        } else {
            await advanceActionPhase({
                sessionId: currentSessionId,
                userId: ws.userId,
                actionId: resolvedActionId,
                phase,
            });
        }
        const spanInfo = markActionPhaseTelemetry(currentSessionId, resolvedActionId, phase);
        logActionFlow('processAction:phase', {
            sessionId: currentSessionId,
            actionId: resolvedActionId,
            userId: ws.userId,
            phase,
            previousPhase: spanInfo?.previousPhase,
            previousPhaseDurationMs: spanInfo?.previousPhaseDurationMs,
        });
    };

    try {
        const {
            sessionId,
            prompt,
            combatState,
            useAiHomebrew,
            apiKey,
            intent,
            actionId,
            clientStateVersion,
            narrationVoice,
            narrationSpeed,
        } = processPayload;
        currentSessionId = sessionId;
        const hasIntent = Boolean(intent && typeof intent === 'object');
        if (!hasIntent && (!prompt || !hasResolvableOpenRouterKey(apiKey))) {
            throw createError(
                400,
                'Servidor de IA indisponível ou prompt vazio. Verifique OPENROUTER_KEY1..N no backend.',
            );
        }
        const pendingRoll = await getPendingRollRequest(sessionId);
        if (pendingRoll) {
            logActionFlow('processAction:blockedByPendingRoll', {
                sessionId,
                actionId: actionId ?? null,
                pendingReason: pendingRoll.reason,
                requestId: pendingRoll.requestId,
            });
            throw createError(409, `Você precisa resolver a rolagem pendente "${pendingRoll.reason}" antes de continuar.`);
        }

        const serverStateVersion = hasCachedSessionStateVersion(sessionId)
            ? getSessionStateVersion(sessionId)
            : await loadSessionStateVersion(sessionId);
        if (typeof clientStateVersion === 'number' && clientStateVersion !== serverStateVersion) {
            ws.send(
                JSON.stringify({
                    type: 'error',
                    payload: {
                        code: 'STATE_DESYNC',
                        message: 'Seu estado está desatualizado. Recarregue a sessão.',
                        expectedVersion: serverStateVersion,
                    },
                }),
            );
            return;
        }

        resolvedActionId = actionId || uuidv4();
        const intentHash = computeIntentHash({
            intent: intent as ActionIntent | undefined,
            prompt,
        });
        registerActionIntentTelemetry(sessionId, resolvedActionId, intentHash);
        instrumentGameEvent(sessionId, 'IntentReceived', {
            actionId: resolvedActionId,
            payload: {
                hasIntent: Boolean(intent),
                intentType: intent?.type ?? null,
            },
        });
        logActionFlow('processAction:received', {
            userId: ws.userId,
            sessionId,
            actionId: resolvedActionId,
            hasIntent: Boolean(intent),
            hasActionId: Boolean(actionId),
            intentHash,
        });
        await recordPhase('RECEIVED');
        logActionFlow('processAction:ack', {
            sessionId,
            actionId: resolvedActionId,
            intentType: intent?.type ?? null,
        });
        ws.send(
            JSON.stringify({
                type: 'actionAck',
                payload: { actionId: resolvedActionId, receivedAt: new Date().toISOString() },
            }),
        );

        await recordPhase('NORMALIZED');
        if (!intent) {
            await recordPhase('RULES');
        }

        if (intent && typeof intent === 'object' && 'type' in intent) {
            logActionFlow('processAction:handleStructuredIntent:start', {
                sessionId,
                actionId: resolvedActionId,
                intentType: intent.type,
            });
            await recordPhase('RULES');
            const intentResult = await handleStructuredIntent({
                sessionId,
                userId: ws.userId,
                intent: intent as ActionIntent,
                ws,
                actionId: resolvedActionId,
                combatState: combatState as never,
                apiKey,
                prompt,
                useAiHomebrew,
                narrationVoice,
                narrationSpeed,
            });
            logActionFlow('processAction:handleStructuredIntent:result', {
                sessionId,
                actionId: resolvedActionId,
                intentType: intent.type,
                status: intentResult,
            });
            if (intentResult === 'handled') {
                await recordPhase('DELTA_APPLIED');
                return;
            }
        }

        logActionFlow('processAction:startAiPrompt', {
            sessionId,
            actionId: resolvedActionId,
        });
        await recordPhase('AI_SYNTHESIS');
        options.activeActions.add(resolvedActionId);
        const { processFreeActionWithDmFlow } = await import('../services/dm/dmTurnOrchestrator.js');
        const { isNarrationQueuedResponse } = await import('../queue/narrationDispatch.js');
        const response = await processFreeActionWithDmFlow({
            sessionId,
            userId: ws.userId,
            playerAction: prompt as string,
            apiKey,
            combatState: combatState as never,
            useAiHomebrew,
            actionId: resolvedActionId,
            narrationTts: { narrationVoice, narrationSpeed },
            ws,
        });
        logActionFlow('processAction:aiResponse', {
            sessionId,
            actionId: resolvedActionId,
            logEntries: response?.logEntries?.length ?? 0,
            hasRollRequest: Boolean(response?.playerRollRequest),
            queued: isNarrationQueuedResponse(response),
        });

        if (isNarrationQueuedResponse(response)) {
            await recordPhase('DELTA_APPLIED');
            emitActionRelease(ws, resolvedActionId);
            return;
        }

        if (isOssStreamEnabled() && resolvedActionId) {
            const { wrapNarrationStreamPayload } = await import('../ai-oss/core/streamPolicy.js');
            unregisterStream = registerNarrationStreamSink(resolvedActionId, evt => {
                ws.send(
                    JSON.stringify({
                        type: 'narrationStream',
                        payload: wrapNarrationStreamPayload(resolvedActionId, evt.kind, evt),
                    }),
                );
            });
            ws.send(JSON.stringify({ type: 'narrationLoading', payload: { actionId: resolvedActionId } }));
        }

        const responseStateVersion = (response as { stateVersion?: number } | undefined)?.stateVersion;
        const newStateVersion =
            typeof responseStateVersion === 'number'
                ? responseStateVersion
                : await bumpSessionStateVersion(sessionId);
        setSessionStateVersion(sessionId, newStateVersion);
        const enrichedResponse = { ...response, stateVersion: newStateVersion };
        if (cancelledActions.has(resolvedActionId)) {
            cancelledActions.delete(resolvedActionId);
            logActionFlow('processAction:responseDiscarded', {
                sessionId,
                actionId: resolvedActionId,
            });
            emitActionRelease(ws, resolvedActionId);
        } else if (response?.playerRollRequest) {
            ws.send(
                JSON.stringify({
                    type: 'gameStateUpdate',
                    payload: { ...enrichedResponse, stateVersion: newStateVersion },
                }),
            );
            ws.send(
                JSON.stringify({
                    type: 'actionResolution',
                    payload: {
                        actionId: resolvedActionId,
                        stateVersion: newStateVersion,
                        status: 'needs_roll',
                        result: response,
                    },
                }),
            );
        } else {
            ws.send(
                JSON.stringify({
                    type: 'actionResolution',
                    payload: {
                        actionId: resolvedActionId,
                        stateVersion: newStateVersion,
                        status: 'accepted',
                        result: response,
                    },
                }),
            );
            ws.send(JSON.stringify({ type: 'gameStateUpdate', payload: enrichedResponse }));
            ws.send(JSON.stringify({ type: 'narrationComplete', payload: { actionId: resolvedActionId } }));
        }
        await recordPhase('DELTA_APPLIED');
    } catch (error: unknown) {
        const err = error as { message?: string; status?: number; code?: string };
        console.error('[WSS] Erro ao processar ação:', error);
        emitActionRelease(ws, resolvedActionId);
        ws.send(
            JSON.stringify({
                type: 'error',
                payload: {
                    message: err.message || 'Erro interno no servidor.',
                    code: err.status || err.code || 'PROCESS_ACTION_ERROR',
                    actionId: resolvedActionId ?? null,
                },
            }),
        );
    } finally {
        if (resolvedActionId) {
            unregisterStream?.();
            clearNarrationStreamSink(resolvedActionId);
            emitActionRelease(ws, resolvedActionId);
            options.activeActions.delete(resolvedActionId);
            logActionFlow('processAction:finalized', {
                actionId: resolvedActionId,
                sessionId: currentSessionId,
            });
            if (currentSessionId) {
                clearActionTelemetry(currentSessionId, resolvedActionId);
            }
        }
        if (phaseLockAcquired && resolvedActionId && currentSessionId) {
            try {
                await clearActionPhase({ sessionId: currentSessionId, actionId: resolvedActionId });
            } catch (phaseError) {
                console.warn('[ActionPhase] Falha ao limpar fase da ação.', {
                    sessionId: currentSessionId,
                    actionId: resolvedActionId,
                    error: phaseError instanceof Error ? phaseError.message : String(phaseError),
                });
            }
        }
    }
}
