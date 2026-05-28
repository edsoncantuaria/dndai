import createError from 'http-errors';
import { v4 as uuidv4 } from 'uuid';
import { validateActionIntent, type ActionIntent } from '../rules/actionIntentService.js';
import { applyResultingStateDelta } from '../services/stateDeltaService.js';
import { logAppliedDelta } from '../services/deltaLogger.js';
import { recordDamage, recordHealing, recordSpellSlotUse, recordRestMetric } from '../services/deltaMetricsService.js';
import { instrumentGameEvent } from '../services/gameEventInstrumentation.js';
import { buildMechanicalPayload, emitMechanicalStateUpdate } from '../websocket/mechanicalUpdate.js';
import type { ActionPipelineWs } from './types.js';
import {
    bumpSessionStateVersion,
    emitActionRelease,
    getSessionStateVersion,
    startActionTimer,
} from './context.js';

export type IntentHandlingResult = 'handled' | 'validated';

export const handleStructuredIntent = async ({
    sessionId,
    userId,
    intent,
    ws,
    actionId,
    combatState,
    apiKey,
    prompt,
    useAiHomebrew,
    narrationVoice,
    narrationSpeed,
}: {
    sessionId: number;
    userId: number;
    intent: ActionIntent;
    ws: ActionPipelineWs;
    actionId: string;
    combatState?: any;
    apiKey?: string;
    prompt?: string;
    useAiHomebrew?: boolean;
    narrationVoice?: string;
    narrationSpeed?: string;
}): Promise<IntentHandlingResult> => {
    const { result } = await validateActionIntent(sessionId, userId, intent, { combatState });
    instrumentGameEvent(sessionId, 'IntentValidated', {
        actionId,
        payload: { intentType: intent.type, status: result.status },
    });

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
                }),
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
                }),
            );
            ws.send(
                JSON.stringify({
                    type: 'gameStateUpdate',
                    payload: { ...response, stateVersion: newVersion },
                }),
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
            }),
        );
        ws.send(
            JSON.stringify({
                type: 'startLoading',
                payload: { actionId: issuedRoll.requestId ?? requestId, receivedAt: new Date().toISOString() },
            }),
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
            }),
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
            instrumentGameEvent(sessionId, 'DeltaApplied', {
                actionId,
                stateVersion: newVersion,
                payload: { intentType: intent.type },
            });
        }
        await emitMechanicalStateUpdate(
            ws,
            sessionId,
            buildMechanicalPayload({
                stateVersion: newVersion,
                actionId,
                resolutionResult: {
                    updatedCharacter: applied.updatedCharacter,
                    updatedEntity: applied.updatedEntities[0],
                },
            }),
        );
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
            }),
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
            }),
        );

        if (apiKey?.trim()) {
            const { buildDmPlayerActionPrompt } = await import('../services/dm/dmPromptBuilder.js');
            const { getCastSummaryForSession } = await import('../services/sessionCastService.js');
            const { dispatchNarrationToQueue } = await import('../queue/narrationDispatch.js');
            const castSummary = await getCastSummaryForSession(sessionId);
            const playerAction = prompt?.trim() || `Executou ${intent.type}`;
            const narratePrompt = buildDmPlayerActionPrompt({
                phase: combatState?.isActive ? 'combat' : 'action',
                playerAction,
                castSummary,
                combatActive: Boolean(combatState?.isActive),
            });
            const queued = await dispatchNarrationToQueue({
                ws,
                sessionId,
                userId,
                actionId,
                stateVersion: newVersion,
                job: {
                    kind: 'action',
                    playerAction: narratePrompt,
                    apiKey,
                    combatState,
                    useAiHomebrew,
                    narrationVoice,
                    narrationSpeed,
                },
            });
            if (queued) {
                emitActionRelease(ws, actionId);
                return 'handled';
            }
        }

        return 'validated';
    }

    return 'validated';
};
