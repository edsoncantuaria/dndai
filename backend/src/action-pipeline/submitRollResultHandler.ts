import createError from 'http-errors';
import { v4 as uuidv4 } from 'uuid';
import {
    getPendingRollRequest,
    clearPendingRollRequest,
    savePendingRollRequest,
} from '../services/rollRequestService.js';
import { hasResolvableOpenRouterKey } from '../ai-oss/core/apiKeyResolve.js';
import { resolveStructuredRoll } from '../services/ruleResolutionService.js';
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { sanitizeRollValues, computeRawRollFromValues, buildRollResolutionPrompt } from '../websocket/utils.js';
import { buildMechanicalPayload } from '../websocket/mechanicalUpdate.js';
import { recordNarrationLatencyMs } from '../telemetry/pipelineLatency.js';
import { recordGameEvent } from '../events/recordGameEvent.js';
import { instrumentGameEvent } from '../services/gameEventInstrumentation.js';
import type { ActionPipelineWs, SubmitRollResultPayload } from './types.js';
import {
    bumpSessionStateVersion,
    emitActionRelease,
    getSessionStateVersion,
    hasCachedSessionStateVersion,
    loadSessionStateVersion,
    logActionFlow,
    startActionTimer,
} from './context.js';

export async function handleSubmitRollResult(ws: ActionPipelineWs, rawPayload: unknown): Promise<void> {
    if (!ws.userId) return;

    let requestId: string | undefined;
    try {
        const {
            sessionId,
            requestId: rollRequestId,
            rolls,
            apiKey,
            combatState,
            useAiHomebrew,
            clientStateVersion,
            narrationVoice,
            narrationSpeed,
        } = rawPayload as SubmitRollResultPayload;
        requestId = rollRequestId;

        if (!sessionId || !requestId || !hasResolvableOpenRouterKey(apiKey)) {
            throw createError(400, 'Dados insuficientes para enviar o resultado da rolagem.');
        }
        logActionFlow('roll:submit:start', {
            sessionId,
            requestId,
            actionId: requestId,
            diceCount: Array.isArray(rolls) ? rolls.length : 0,
        });

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

        const diceValues = sanitizeRollValues(rolls as unknown[]);
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
            if (resolutionResult) {
                const { advanceCombatPhaseAfterRoll } = await import('../combat/combatPhaseService.js');
                await advanceCombatPhaseAfterRoll(sessionId, {
                    hasFollowUpRoll: Boolean(resolutionResult.nextRollRequest),
                    shouldNarrate: resolutionResult.shouldNarrate !== false,
                });
            }
            logActionFlow('roll:resolveStructured:result', {
                sessionId,
                requestId,
                updatedCharacter: Boolean(resolutionResult?.updatedCharacter),
                updatedEntity: Boolean(resolutionResult?.updatedEntity),
                followUp: resolutionResult?.nextRollRequest?.request.rollType ?? null,
                hints: resolutionResult?.hints?.length ?? 0,
            });
            void recordGameEvent({
                sessionId,
                actionId: pending.context?.actionId ?? requestId,
                type: 'RollResolved',
                stateVersion: stateVersionAfterResolution,
                payload: {
                    total,
                    rawRoll,
                    rollType: pending.rollType,
                    hit: resolutionResult?.attackOutcome?.hit,
                },
            }).catch(() => undefined);
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
            await savePendingRollRequest(sessionId, ws.userId, followUpRequest as typeof followUpRequest & { requestId: string }, followUp.context);
            ws.send(
                JSON.stringify({
                    type: 'actionResolution',
                    payload: {
                        actionId: requestId,
                        stateVersion: stateVersionAfterResolution,
                        status: 'accepted',
                        result: {
                            attackOutcome: resolutionResult?.attackOutcome,
                            followUp: followUpRequest.rollType,
                        },
                    },
                }),
            );
            ws.send(
                JSON.stringify({
                    type: 'gameStateUpdate',
                    payload: {
                        stateVersion: stateVersionAfterResolution,
                        playerRollRequest: followUpRequest,
                    },
                }),
            );
            logActionFlow('roll:followUpIssued', {
                sessionId,
                requestId,
                nextRequestId,
                rollType: followUpRequest.rollType,
                actionId: pending.context?.actionId ?? requestId,
            });
            ws.send(JSON.stringify({ type: 'stopLoading', payload: { actionId: requestId } }));
            return;
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
                }),
            );
            ws.send(
                JSON.stringify({
                    type: 'gameStateUpdate',
                    payload: {
                        stateVersion: newStateVersion,
                        updatedCharacter: resolutionResult?.updatedCharacter ?? undefined,
                        updatedEntities: resolutionResult?.updatedEntity ? [resolutionResult.updatedEntity] : undefined,
                    },
                }),
            );
            ws.send(JSON.stringify({ type: 'stopLoading', payload: { actionId: requestId } }));
            return;
        }

        ws.send(JSON.stringify({ type: 'startLoading', payload: { actionId: requestId } }));
        startActionTimer(ws, requestId);

        const rollActionId = pending.context?.actionId ?? requestId;
        const mechanicalPayload = buildMechanicalPayload({
            stateVersion: stateVersionAfterResolution,
            actionId: rollActionId,
            resolutionResult,
        });
        const isCriticalEvent = Boolean(
            resolutionResult?.updatedEntity && Number(resolutionResult.updatedEntity.hp) <= 0,
        );
        const { dispatchNarrationToQueue } = await import('../queue/narrationDispatch.js');
        const enqueued = await dispatchNarrationToQueue({
            ws,
            sessionId,
            userId: ws.userId,
            actionId: rollActionId,
            stateVersion: stateVersionAfterResolution,
            mechanicalPayload,
            releaseRollRequestId: requestId,
            job: {
                kind: 'roll',
                criticality: isCriticalEvent ? 'critical' : 'normal',
                playerAction: actionText,
                apiKey,
                useAiHomebrew,
                narrationVoice,
                narrationSpeed,
                combatState,
                pending: pending as typeof pending & { requestId: string; userId: number },
                diceValues,
                resolutionResult,
                rollTotal: total,
            },
        });
        if (enqueued) {
            return;
        }

        let response;
        try {
            void recordGameEvent({
                sessionId,
                actionId: rollActionId,
                type: 'NarrationRequested',
                stateVersion: stateVersionAfterResolution,
            }).catch(() => undefined);

            const { completeManualRollAndNarrate } = await import('../services/dm/dmTurnOrchestrator.js');
            const narrationT0 = performance.now();
            response = await completeManualRollAndNarrate({
                sessionId,
                userId: ws.userId,
                apiKey,
                pending,
                diceValues,
                combatState: combatState as never,
                useAiHomebrew,
                resolutionResult,
                narrationTts: { narrationVoice, narrationSpeed },
            });
            recordNarrationLatencyMs(performance.now() - narrationT0);
            if (!resolutionResult?.nextRollRequest) {
                await clearPendingRollRequest(sessionId);
            }
            const newStateVersion =
                stateVersionAfterResolution === serverStateVersion
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
                const { applyMotorPostRollEffects } = await import('../services/motorPostRollService.js');
                const postRoll = await applyMotorPostRollEffects({
                    sessionId,
                    pending,
                    total,
                    resolutionResult,
                    combatState: combatState as never,
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
                    const { postMotorCombatSync } = await import('../services/combatMotorService.js');
                    const fallbackSync = await postMotorCombatSync(sessionId, {
                        clientCombat: (combatState ?? undefined) as never,
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
            ws.send(
                JSON.stringify({
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
                }),
            );
            ws.send(JSON.stringify({ type: 'gameStateUpdate', payload: enrichedResponse }));
            instrumentGameEvent(sessionId, 'NarrationCompleted', {
                actionId: pending?.context?.actionId ?? requestId,
                stateVersion: newStateVersion,
            });
        } finally {
            emitActionRelease(ws, requestId);
            logActionFlow('roll:submit:completed', {
                sessionId,
                requestId,
                actionId: pending?.context?.actionId ?? requestId,
                followUpIssued: Boolean(resolutionResult?.nextRollRequest),
            });
        }
    } catch (error: unknown) {
        const err = error as { message?: string };
        console.error('[WSS] Erro ao enviar resultado de rolagem:', error);
        emitActionRelease(ws, requestId);
        ws.send(
            JSON.stringify({
                type: 'error',
                payload: {
                    message: err.message || 'Falha ao registrar resultado da rolagem.',
                    actionId: requestId,
                },
            }),
        );
    }
}
