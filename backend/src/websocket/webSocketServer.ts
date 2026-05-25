// backend/src/websocket/webSocketServer.ts
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import jwt from 'jsonwebtoken';
import { parse as urlParse } from 'url';
import * as NarrarService from '../services/narrarService.js';
import * as CharacterService from '../services/characterService.js';
import createError from 'http-errors';
import { getPendingRollRequest, clearPendingRollRequest, savePendingRollRequest, getRollQueueSize } from '../services/rollRequestService.js';
import type { PlayerRollRequest } from '../types.js';
import { validateActionIntent, type ActionIntent } from '../rules/actionIntentService.js';
import type { RuleCheckResult } from '../rules/types.js';
import { convertRollRequestToPlayerRoll } from '../rules/rollRequestAdapter.js';
import { v4 as uuidv4 } from 'uuid';
import { incrementStateVersion, loadStateVersion } from '../services/stateVersionService.js';
import type { StateDeltaContext } from '../services/characterStateService.js';
import { applyEntityDeltaWithLog } from '../services/combatEntityService.js';
import { resolveStructuredRoll } from '../services/ruleResolutionService.js';
import { applyResultingStateDelta } from '../services/stateDeltaService.js';
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { sanitizeRollValues, computeRawRollFromValues, buildRollResolutionPrompt } from './utils.js';
import { logAppliedDelta } from '../services/deltaLogger.js';
import { recordDamage, recordHealing, recordSpellSlotUse, recordRestMetric } from '../services/deltaMetricsService.js';
import { beginActionPhase, advanceActionPhase, clearActionPhase, type ActionPhase } from '../services/actionPhaseService.js';
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
    getActionTelemetry,
} from '../services/actionObservabilityService.js';
import {
    ProcessActionSchema,
    isContractVersionSupported,
    CURRENT_CONTRACT_VERSION,
} from '../schemas/processActionSchema.js';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  isAlive?: boolean;
}

const ACTION_INTENT_ROLL_TYPE_MAP: Record<ActionIntent['type'], PlayerRollRequest['rollType']> = {
    'weapon-attack': 'attack',
    'skill-check': 'check',
    'spell-attack': 'attack',
    damage: 'damage',
    healing: 'healing',
};

const ACTION_TIMEOUT_MS = Number(process.env.ACTION_TIMEOUT_MS) || 120_000;
const cancelledActions = new Set<string>();
const ACTION_FLOW_DEBUG = process.env.ACTION_FLOW_DEBUG !== 'false';
const logActionFlow = (stage: string, details: Record<string, unknown>) => {
    if (!ACTION_FLOW_DEBUG) return;
    const sessionId =
        typeof details.sessionId === 'number' ? (details.sessionId as number) : null;
    const actionId =
        typeof details.actionId === 'string' ? (details.actionId as string) : null;
    const telemetry =
        sessionId !== null && actionId ? getActionTelemetry(sessionId, actionId) : null;
    const basePayload = {
        ...details,
        traceId: telemetry?.traceId ?? actionId ?? null,
        intentHash: telemetry?.intentHash ?? null,
        phase: details.phase ?? telemetry?.currentPhase ?? undefined,
    };
    if (sessionId == null) {
        console.log(`[ActionFlow] ${stage}`, basePayload);
        return;
    }
    getRollQueueSize(sessionId)
        .then(size => {
            console.log(`[ActionFlow] ${stage}`, {
                ...basePayload,
                rollQueueSize: size,
            });
        })
        .catch(() => {
            console.log(`[ActionFlow] ${stage}`, basePayload);
        });
};
const actionTimers = new Map<string, NodeJS.Timeout>();
const startActionTimer = (ws: WebSocket, actionId: string) => {
    const timer = setTimeout(() => {
        actionTimers.delete(actionId);
        ws.send(JSON.stringify({ type: 'timeout', payload: { actionId } }));
    }, ACTION_TIMEOUT_MS);
    actionTimers.set(actionId, timer);
};
const clearActionTimer = (actionId: string) => {
    const timer = actionTimers.get(actionId);
    if (timer) {
        clearTimeout(timer);
        actionTimers.delete(actionId);
    }
};

/** Garante que o cliente saia do estado "narrando" mesmo em erro ou cancelamento. */
const emitActionRelease = (ws: WebSocket, actionId: string | undefined) => {
    if (!actionId) return;
    clearActionTimer(actionId);
    ws.send(JSON.stringify({ type: 'narrationComplete', payload: { actionId } }));
    ws.send(JSON.stringify({ type: 'stopLoading', payload: { actionId } }));
};
const sessionStateVersions = new Map<number, number>();
const getSessionStateVersion = (sessionId: number) => sessionStateVersions.get(sessionId) ?? 0;
const bumpSessionStateVersion = async (sessionId: number) => {
    const next = await incrementStateVersion(sessionId);
    sessionStateVersions.set(sessionId, next);
    return next;
};

const loadSessionStateVersion = async (sessionId: number) => {
    const fromDb = await loadStateVersion(sessionId);
    sessionStateVersions.set(sessionId, fromDb);
    return fromDb;
};

type IntentHandlingResult = 'handled' | 'validated';

const handleStructuredIntent = async ({
    sessionId,
    userId,
    intent,
    ws,
    actionId,
    combatState,
    apiKey,
    prompt,
    useAiHomebrew,
}: {
    sessionId: number;
    userId: number;
    intent: ActionIntent;
    ws: AuthenticatedWebSocket;
    actionId: string;
    combatState?: any;
    apiKey?: string;
    prompt?: string;
    useAiHomebrew?: boolean;
}): Promise<IntentHandlingResult> => {
    const { result } = await validateActionIntent(sessionId, userId, intent, { combatState });

    if (result.status === 'rejected') {
        throw createError(400, result.reason || 'Ação inválida segundo as regras.');
    }

    if (result.status === 'needs_roll' && result.rollRequest) {
        const mergedMetadata = {
            ...(result.rollRequest.metadata ?? {}),
            ...(result.data ?? {}),
            ...(result.stateDelta?.pendingAttack ? { pendingAttack: result.stateDelta.pendingAttack } : {}),
            playerAction: prompt?.slice(0, 300) ?? '',
        };
        const { ruleResultToPlayerRoll, completeRollAndNarrate, isDmAutoRollEnabled, issuePendingRollToPlayer } =
            await import('../services/dm/dmTurnOrchestrator.js');
        const playerRollRequest = ruleResultToPlayerRoll(intent, result);
        if (!playerRollRequest) {
            throw createError(500, 'Falha ao montar rolagem.');
        }
        const requestId = uuidv4();
        playerRollRequest.requestId = requestId;

        if (isDmAutoRollEnabled() && apiKey?.trim()) {
            ws.send(
                JSON.stringify({
                    type: 'narrationLoading',
                    payload: { actionId, receivedAt: new Date().toISOString() },
                })
            );
            startActionTimer(ws, actionId);
            const response = await completeRollAndNarrate({
                sessionId,
                userId,
                apiKey,
                playerAction: prompt?.trim() || playerRollRequest.reason,
                rollRequest: playerRollRequest,
                combatState: combatState ?? null,
                useAiHomebrew,
                actionId,
                intentType: intent.type,
                intentPayload: intent.payload,
                metadata: mergedMetadata,
            });
            const newVersion = await bumpSessionStateVersion(sessionId);
            ws.send(
                JSON.stringify({
                    type: 'actionResolution',
                    payload: {
                        actionId,
                        stateVersion: newVersion,
                        status: 'accepted',
                        rule: intent.type,
                        autoRoll: true,
                        result: response,
                    },
                })
            );
            ws.send(
                JSON.stringify({
                    type: 'gameStateUpdate',
                    payload: { ...response, stateVersion: newVersion },
                })
            );
            emitActionRelease(ws, actionId);
            return 'handled';
        }

        const rollResponse = await issuePendingRollToPlayer({
            sessionId,
            userId,
            rollRequest: playerRollRequest,
            actionId,
            intentType: intent.type,
            intentPayload: intent.payload,
            metadata: mergedMetadata,
            playerAction: prompt?.trim(),
        });
        const issuedRoll = rollResponse.playerRollRequest ?? playerRollRequest;
        issuedRoll.metadata = {
            ...(issuedRoll.metadata ?? {}),
            actionId,
            intentType: intent.type,
            issuedAt: new Date().toISOString(),
        };

        const currentVersion = await getSessionStateVersion(sessionId);
        ws.send(
            JSON.stringify({
                type: 'gameStateUpdate',
                payload: {
                    ...rollResponse,
                    playerRollRequest: issuedRoll,
                    stateVersion: currentVersion,
                },
            })
        );
        ws.send(
            JSON.stringify({
                type: 'startLoading',
                payload: { actionId: issuedRoll.requestId ?? requestId, receivedAt: new Date().toISOString() },
            })
        );
        startActionTimer(ws, issuedRoll.requestId ?? requestId);
        ws.send(
            JSON.stringify({
                type: 'actionResolution',
                payload: {
                    actionId,
                    stateVersion: getSessionStateVersion(sessionId),
                    status: 'needs_roll',
                    rule: intent.type,
                    rollRequest: issuedRoll,
                },
            })
        );
        return 'handled';
    }

    if (result.status === 'accepted' && result.stateDelta) {
        const applied = await applyResultingStateDelta(sessionId, result.stateDelta, {
            actionId,
            actionType: intent.type,
            expectedStateVersion: getSessionStateVersion(sessionId),
            authoritativeSignature: result.authoritativeSignature ?? null,
        });
        const newVersion = await bumpSessionStateVersion(sessionId);
        if (applied.appliedDelta) {
            await logAppliedDelta({
                sessionId,
                actionId,
                stateVersion: newVersion,
                delta: applied.appliedDelta as Record<string, unknown>,
                metrics: applied.metrics,
            });
        }
        recordDamage(applied.metrics.damage);
        recordHealing(applied.metrics.healing);
        recordSpellSlotUse(applied.metrics.spellSlotsUsed);
        recordRestMetric(applied.metrics.restType);
        ws.send(
            JSON.stringify({
                type: 'actionResolution',
                payload: {
                    actionId,
                    stateVersion: newVersion,
                    status: 'accepted',
                    stateDelta: result.stateDelta ?? null,
                    result: {
                        updatedCharacter: applied.updatedCharacter ?? undefined,
                        updatedEntities: applied.updatedEntities.length ? applied.updatedEntities : undefined,
                    },
                },
            })
        );
        ws.send(
            JSON.stringify({
                type: 'gameStateUpdate',
                payload: {
                    stateVersion: newVersion,
                    updatedCharacter: applied.updatedCharacter ?? undefined,
                    updatedEntities: applied.updatedEntities.length ? applied.updatedEntities : undefined,
                    stateDelta: result.stateDelta ?? undefined,
                },
            })
        );
        return 'validated';
    }

    return 'validated';
};

export function configureWebSocket(httpServer: Server) {
    const wss = new WebSocketServer({ server: httpServer });

    wss.on('connection', async (ws: AuthenticatedWebSocket, req) => {
        console.log('[WSS] Novo cliente conectado.');
        const activeActions = new Set<string>();

        // Autenticação via token na URL
        const query = urlParse(req.url || '', true).query;
        const token = query.token as string;
        
        if (!token) {
            console.warn('[WSS] Cliente conectado sem token. Encerrando conexão.');
            ws.close(1008, 'Token não fornecido');
            return;
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: number };
            ws.userId = decoded.userId;
            ws.isAlive = true;
            console.log(`[WSS] Cliente autenticado para userId: ${ws.userId}`);
        } catch (error) {
            console.error('[WSS] Falha na verificação do token:', error);
            ws.close(1008, 'Token inválido');
            return;
        }

        ws.on('pong', () => {
            ws.isAlive = true;
        });

        ws.on('message', async (message: string) => {
            if (!ws.userId) return;

            let data;
            try {
                data = JSON.parse(message);
            } catch (e) {
                ws.send(JSON.stringify({ type: 'error', payload: { message: 'Mensagem inválida (não é JSON).' } }));
                return;
            }

            console.log(`[WSS] Mensagem recebida de userId ${ws.userId}:`, data.type);

            switch (data.type) {
                case 'processAction': {
                    const validation = ProcessActionSchema.safeParse(data.payload);
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
                            })
                        );
                        break;
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
                            })
                        );
                        break;
                    }
                    if (!processPayload.sessionId) {
                        ws.send(
                            JSON.stringify({
                                type: 'error',
                                payload: {
                                    code: 'INVALID_SESSION',
                                    message: 'sessionId é obrigatório neste contrato.',
                                },
                            })
                        );
                        break;
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

                        const serverStateVersion = sessionStateVersions.has(sessionId)
                            ? getSessionStateVersion(sessionId)
                            : await loadSessionStateVersion(sessionId);
                        if (typeof clientStateVersion === 'number' && clientStateVersion !== serverStateVersion) {
                            ws.send(JSON.stringify({
                                type: 'error',
                                payload: {
                                    code: 'STATE_DESYNC',
                                    message: 'Seu estado está desatualizado. Recarregue a sessão.',
                                    expectedVersion: serverStateVersion,
                                },
                            }));
                            break;
                        }

                        resolvedActionId = actionId || uuidv4();
                        const intentHash = computeIntentHash({
                            intent: intent as ActionIntent | undefined,
                            prompt,
                        });
                        registerActionIntentTelemetry(sessionId, resolvedActionId, intentHash);
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
                        ws.send(JSON.stringify({ type: 'actionAck', payload: { actionId: resolvedActionId, receivedAt: new Date().toISOString() } }));

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
                                combatState,
                                apiKey,
                                prompt,
                                useAiHomebrew,
                            });
                            logActionFlow('processAction:handleStructuredIntent:result', {
                                sessionId,
                                actionId: resolvedActionId,
                                intentType: intent.type,
                                status: intentResult,
                            });
                            if (intentResult === 'handled') {
                                break;
                            }
                        }

                        logActionFlow('processAction:startAiPrompt', {
                            sessionId,
                            actionId: resolvedActionId,
                        });
                        await recordPhase('AI_SYNTHESIS');
                        ws.send(JSON.stringify({ type: 'narrationLoading', payload: { actionId: resolvedActionId } }));
                        activeActions.add(resolvedActionId);
                        if (isOssStreamEnabled() && resolvedActionId) {
                            unregisterStream = registerNarrationStreamSink(resolvedActionId, evt => {
                                ws.send(
                                    JSON.stringify({
                                        type: 'narrationStream',
                                        payload: { actionId: resolvedActionId, ...evt },
                                    }),
                                );
                            });
                        }
                        const { processFreeActionWithDmFlow } = await import(
                            '../services/dm/dmTurnOrchestrator.js'
                        );
                        const response = await processFreeActionWithDmFlow({
                            sessionId,
                            userId: ws.userId,
                            playerAction: prompt,
                            apiKey,
                            combatState,
                            useAiHomebrew,
                            actionId: resolvedActionId,
                        });
                        logActionFlow('processAction:aiResponse', {
                            sessionId,
                            actionId: resolvedActionId,
                            logEntries: response?.logEntries?.length ?? 0,
                            hasRollRequest: Boolean(response?.playerRollRequest),
                        });

                        const newStateVersion =
                            typeof response?.stateVersion === 'number'
                                ? response.stateVersion
                                : await bumpSessionStateVersion(sessionId);
                        sessionStateVersions.set(sessionId, newStateVersion);
                        const enrichedResponse = { ...response, stateVersion: newStateVersion };
                        if (cancelledActions.has(resolvedActionId)) {
                            cancelledActions.delete(resolvedActionId);
                            logActionFlow('processAction:responseDiscarded', {
                                sessionId,
                                actionId: resolvedActionId,
                            });
                            emitActionRelease(ws, resolvedActionId);
                        } else {
                            ws.send(JSON.stringify({
                                type: 'actionResolution',
                                payload: {
                                    actionId: resolvedActionId,
                                    stateVersion: newStateVersion,
                                    status: 'accepted',
                                    result: response,
                                },
                            }));
                            ws.send(JSON.stringify({ type: 'gameStateUpdate', payload: enrichedResponse }));
                            ws.send(JSON.stringify({ type: 'narrationComplete', payload: { actionId: resolvedActionId } }));
                        }
                        await recordPhase('DELTA_APPLIED');
                    } catch (error: any) {
                        console.error('[WSS] Erro ao processar ação:', error);
                        emitActionRelease(ws, resolvedActionId);
                        ws.send(JSON.stringify({
                            type: 'error',
                            payload: {
                                message: error.message || 'Erro interno no servidor.',
                                code: error.status || error.code || 'PROCESS_ACTION_ERROR',
                                actionId: resolvedActionId ?? null,
                            },
                        }));
                    } finally {
                        if (resolvedActionId) {
                            unregisterStream?.();
                            clearNarrationStreamSink(resolvedActionId);
                            emitActionRelease(ws, resolvedActionId);
                            activeActions.delete(resolvedActionId);
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
                    break;
                }
                
                case 'submitRollResult':
                    try {
                        const { sessionId, requestId, rolls, apiKey, combatState, useAiHomebrew, clientStateVersion } = data.payload;
                        if (!sessionId || !requestId || !hasResolvableOpenRouterKey(apiKey)) {
                            throw createError(400, 'Dados insuficientes para enviar o resultado da rolagem.');
                        }
                        logActionFlow('roll:submit:start', {
                            sessionId,
                            requestId,
                            actionId: requestId,
                            diceCount: Array.isArray(rolls) ? rolls.length : 0,
                        });

                        const serverStateVersion = sessionStateVersions.has(sessionId)
                            ? getSessionStateVersion(sessionId)
                            : await loadSessionStateVersion(sessionId);
                        if (typeof clientStateVersion === 'number' && clientStateVersion !== serverStateVersion) {
                            ws.send(JSON.stringify({
                                type: 'error',
                                payload: {
                                    code: 'STATE_DESYNC',
                                    message: 'Seu estado está desatualizado. Recarregue a sessão.',
                                    expectedVersion: serverStateVersion,
                                },
                            }));
                            break;
                        }

                        const pending = await getPendingRollRequest(sessionId);
                        if (!pending) {
                            throw createError(409, 'Não há rolagens pendentes para esta sessão.');
                        }
                        if (pending.userId !== ws.userId) {
                            throw createError(403, 'Você não tem permissão para resolver esta rolagem.');
                        }
                        if (pending.requestId !== requestId) {
                            throw createError(400, 'Identificador da rolagem inválido ou expirado.');
                        }
                        logActionFlow('roll:pendingLoaded', {
                            sessionId,
                            requestId,
                            actionId: pending.context?.actionId ?? requestId,
                            rollType: pending.rollType,
                            intentType: pending.context?.intentType ?? null,
                        });

                        const diceValues = sanitizeRollValues(rolls);
                        if (!diceValues.length) {
                            throw createError(400, 'Nenhuma rolagem válida foi recebida.');
                        }

                        const rawRoll = computeRawRollFromValues(pending, diceValues);
                        const modifier = pending.modifier || 0;
                        const total = rawRoll + modifier;
                        let actionText = buildRollResolutionPrompt(pending, diceValues, rawRoll, total);
                        let resolutionResult = null;
                        let stateVersionAfterResolution = serverStateVersion;
                        try {
                            logActionFlow('roll:resolveStructured:start', {
                                sessionId,
                                requestId,
                                total,
                                rawRoll,
                                rollType: pending.rollType,
                            });
                            resolutionResult = await resolveStructuredRoll(sessionId, pending, {
                                total,
                                rawRoll,
                                diceValues,
                            });
                            logActionFlow('roll:resolveStructured:result', {
                                sessionId,
                                requestId,
                                updatedCharacter: Boolean(resolutionResult?.updatedCharacter),
                                updatedEntity: Boolean(resolutionResult?.updatedEntity),
                                followUp: resolutionResult?.nextRollRequest?.request.rollType ?? null,
                                hints: resolutionResult?.hints?.length ?? 0,
                            });
                            if (resolutionResult && (resolutionResult.updatedCharacter || resolutionResult.updatedEntity)) {
                                stateVersionAfterResolution = await bumpSessionStateVersion(sessionId);
                            }
                        } catch (resolutionError) {
                            console.error('[WSS] Falha ao aplicar efeitos da rolagem estruturada:', resolutionError);
                        }

                        if (resolutionResult?.attackOutcome) {
                            const outcomeText = resolutionResult.attackOutcome.hit
                                ? 'Ataque bem-sucedido'
                                : 'Ataque falhou';
                            actionText = `${actionText} (${outcomeText})`;
                        }

                        const followUp = resolutionResult?.nextRollRequest;
                        if (followUp) {
                            await clearPendingRollRequest(sessionId);
                            const followUpRequest = followUp.request;
                            const nextRequestId = uuidv4();
                            followUpRequest.requestId = nextRequestId;
                            await savePendingRollRequest(sessionId, ws.userId, followUpRequest, followUp.context);
                            ws.send(
                                JSON.stringify({
                                    type: 'actionResolution',
                                    payload: {
                                        actionId: requestId,
                                        stateVersion: stateVersionAfterResolution,
                                        status: 'accepted',
                                        result: {
                                            attackOutcome: resolutionResult.attackOutcome,
                                            followUp: followUpRequest.rollType,
                                        },
                                    },
                                })
                            );
                            ws.send(
                                JSON.stringify({
                                    type: 'gameStateUpdate',
                                    payload: {
                                        stateVersion: stateVersionAfterResolution,
                                        playerRollRequest: followUpRequest,
                                    },
                                })
                            );
                            logActionFlow('roll:followUpIssued', {
                                sessionId,
                                requestId,
                                nextRequestId,
                                rollType: followUpRequest.rollType,
                                actionId: pending.context?.actionId ?? requestId,
                            });
                            ws.send(JSON.stringify({ type: 'stopLoading', payload: { actionId: requestId } }));
                            break;
                        }

                        const narrate = resolutionResult?.shouldNarrate !== false;
                        if (!narrate) {
                            await clearPendingRollRequest(sessionId);
                            const newStateVersion =
                                stateVersionAfterResolution === serverStateVersion
                                    ? await bumpSessionStateVersion(sessionId)
                                    : stateVersionAfterResolution;
                            ws.send(
                                JSON.stringify({
                                    type: 'actionResolution',
                                    payload: {
                                        actionId: requestId,
                                        stateVersion: newStateVersion,
                                        status: 'accepted',
                                        result: {
                                            attackOutcome: resolutionResult?.attackOutcome,
                                        },
                                        updatedCharacter: resolutionResult?.updatedCharacter ?? undefined,
                                        updatedEntities: resolutionResult?.updatedEntity ? [resolutionResult.updatedEntity] : undefined,
                                    },
                                })
                            );
                            ws.send(
                                JSON.stringify({
                                    type: 'gameStateUpdate',
                                    payload: {
                                        stateVersion: newStateVersion,
                                        updatedCharacter: resolutionResult?.updatedCharacter ?? undefined,
                                        updatedEntities: resolutionResult?.updatedEntity ? [resolutionResult.updatedEntity] : undefined,
                                    },
                                })
                            );
                            ws.send(JSON.stringify({ type: 'stopLoading', payload: { actionId: requestId } }));
                            break;
                        }

                        ws.send(JSON.stringify({ type: 'startLoading', payload: { actionId: requestId } }));
                        startActionTimer(ws, requestId);

                        let response;
                        try {
                            const { completeManualRollAndNarrate } = await import(
                                '../services/dm/dmTurnOrchestrator.js'
                            );
                            response = await completeManualRollAndNarrate({
                                sessionId,
                                userId: ws.userId,
                                apiKey,
                                pending,
                                diceValues,
                                combatState,
                                useAiHomebrew,
                                resolutionResult,
                            });
                            if (!resolutionResult?.nextRollRequest) {
                                await clearPendingRollRequest(sessionId);
                            }
                            const newStateVersion = stateVersionAfterResolution === serverStateVersion
                                ? await bumpSessionStateVersion(sessionId)
                                : stateVersionAfterResolution;
                            const enrichedResponse = {
                                ...response,
                                stateVersion: newStateVersion,
                                updatedCharacter: resolutionResult?.updatedCharacter ?? undefined,
                                updatedEntities: resolutionResult?.updatedEntity ? [resolutionResult.updatedEntity] : undefined,
                            };
                            try {
                                const sessaoRepo = AppDataSource.getRepository(SessaoIA);
                                const sessaoRow = await sessaoRepo.findOne({
                                    where: { id: sessionId },
                                    select: ['id', 'characterId'],
                                });
                                const { applyMotorPostRollEffects } = await import(
                                    '../services/motorPostRollService.js'
                                );
                                const postRoll = await applyMotorPostRollEffects({
                                    sessionId,
                                    pending,
                                    total,
                                    resolutionResult,
                                    combatState,
                                });
                                const motorSync = postRoll.motorCombat;
                                if (motorSync?.publicState !== undefined) {
                                    enrichedResponse.combatState = motorSync.publicState as typeof enrichedResponse.combatState;
                                }
                                if (motorSync?.rewards?.lootOffer) {
                                    enrichedResponse.lootOffer = motorSync.rewards.lootOffer;
                                }
                                if (postRoll.skillXp?.xpAwarded) {
                                    enrichedResponse.progressionFeed = [
                                        ...(Array.isArray(enrichedResponse.progressionFeed)
                                            ? enrichedResponse.progressionFeed
                                            : []),
                                        {
                                            type: 'xp_gain',
                                            xp: postRoll.skillXp.xpAwarded,
                                            summary: `+${postRoll.skillXp.xpAwarded} XP — teste bem-sucedido`,
                                            source: 'motor-skill',
                                        },
                                    ];
                                }
                                if (!motorSync) {
                                    const { postMotorCombatSync } = await import(
                                        '../services/combatMotorService.js'
                                    );
                                    const fallbackSync = await postMotorCombatSync(sessionId, {
                                        clientCombat: combatState ?? undefined,
                                        characterId: sessaoRow?.characterId ?? undefined,
                                    });
                                    if (fallbackSync?.publicState !== undefined) {
                                        enrichedResponse.combatState = fallbackSync.publicState;
                                    }
                                    if (fallbackSync?.rewards?.lootOffer) {
                                        enrichedResponse.lootOffer = fallbackSync.rewards.lootOffer;
                                    }
                                }
                            } catch (motorSyncError) {
                                console.warn('[WSS] motor pós-rolagem falhou:', motorSyncError);
                            }
                            ws.send(JSON.stringify({
                                type: 'actionResolution',
                                payload: {
                                    actionId: requestId,
                                    stateVersion: newStateVersion,
                                    status: 'accepted',
                                    result: {
                                        ...response,
                                        attackOutcome: resolutionResult?.attackOutcome,
                                    },
                                    updatedCharacter: resolutionResult?.updatedCharacter ?? undefined,
                                    updatedEntities: resolutionResult?.updatedEntity ? [resolutionResult.updatedEntity] : undefined,
                                },
                            }));
                            ws.send(JSON.stringify({ type: 'gameStateUpdate', payload: enrichedResponse }));
                        } finally {
                            emitActionRelease(ws, requestId);
                            logActionFlow('roll:submit:completed', {
                                sessionId,
                                requestId,
                                actionId: pending?.context?.actionId ?? requestId,
                                followUpIssued: Boolean(resolutionResult?.nextRollRequest),
                            });
                        }
                    } catch (error: any) {
                        console.error('[WSS] Erro ao enviar resultado de rolagem:', error);
                        emitActionRelease(ws, requestId);
                        ws.send(JSON.stringify({ type: 'error', payload: { message: error.message || 'Falha ao registrar resultado da rolagem.', actionId: requestId } }));
                    }
                    break;

                case 'getCharacter':
                     try {
                        const { characterId } = data.payload;
                        if (!characterId) {
                            throw createError(400, "ID do personagem não fornecido.");
                        }
                        const character = await CharacterService.getCharacterById(characterId, ws.userId);
                        ws.send(JSON.stringify({ type: 'characterUpdate', payload: character }));

                     } catch(error: any) {
                        ws.send(JSON.stringify({ type: 'error', payload: { message: error.message || 'Erro ao buscar personagem.' } }));
                     }
                     break;

                default:
                    ws.send(JSON.stringify({ type: 'error', payload: { message: `Tipo de mensagem desconhecido: ${data.type}` } }));
            }
        });

        ws.on('close', () => {
            if (activeActions.size) {
                activeActions.forEach(id => cancelledActions.add(id));
                activeActions.clear();
            }
            console.log(`[WSS] Cliente (userId: ${ws.userId}) desconectado.`);
        });

        ws.on('error', (error) => {
            console.error(`[WSS] Erro na conexão do cliente (userId: ${ws.userId}):`, error);
        });
    });

    const interval = setInterval(() => {
        wss.clients.forEach(client => {
            const ws = client as AuthenticatedWebSocket;
            
            // Lógica corrigida: se estiver inativo, termina. Senão, prepara para o próximo ciclo.
            if (ws.isAlive === false) {
                console.log(`[WSS] Cliente (userId: ${ws.userId}) inativo. Encerrando conexão.`);
                ws.terminate();
            } else {
                ws.isAlive = false;
                ws.ping();
            }
        });
    }, 30000);

    wss.on('close', () => {
        clearInterval(interval);
        console.log('[WSS] Servidor WebSocket encerrado.');
    });

    console.log('[WSS] Servidor WebSocket configurado e aguardando conexões.');
}
