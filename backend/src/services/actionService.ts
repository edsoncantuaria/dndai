import { applyResultingStateDelta } from './stateDeltaService.js';
import { validateActionIntent, type ActionIntent } from '../rules/actionIntentService.js';
import { convertRollRequestToPlayerRoll } from '../rules/rollRequestAdapter.js';
import { v4 as uuidv4 } from 'uuid';
import { incrementStateVersion, loadStateVersion } from './stateVersionService.js';
import { savePendingRollRequest, getPendingRollRequest } from './rollRequestService.js';
import * as NarrarService from './narrarService.js';
import { applyRegionTransition } from './regionTransitionService.js';
import createError from 'http-errors';
import type { PlayerRollRequest } from '../types.js';
import type { CombatState } from '../schemas/gameSchemas.js';
import { logAppliedDelta } from './deltaLogger.js';
import { recordDamage, recordHealing, recordSpellSlotUse, recordRestMetric } from './deltaMetricsService.js';
import { heartbeatSessionLeaseOrThrow, validateAndPersistActionCursor } from './sessionRuntimeService.js';
import { beginActionPhase, advanceActionPhase, clearActionPhase } from './actionPhaseService.js';
import {
    computeIntentHash,
    registerActionIntentTelemetry,
    clearActionTelemetry,
} from './actionObservabilityService.js';

interface ProcessActionInput {
    sessionId: number;
    userId: number;
    body: {
        prompt?: string;
        intent?: ActionIntent;
        combatState?: CombatState | null;
        apiKey?: string;
        useAiHomebrew?: boolean;
        model?: string;
        clientStateVersion?: number;
        actionId?: string;
        clientInstanceId?: string;
        actionCursor?: number;
    };
}

type ActionServiceDeps = {
    validateAndPersistActionCursor: typeof validateAndPersistActionCursor;
    heartbeatSessionLeaseOrThrow: typeof heartbeatSessionLeaseOrThrow;
    loadStateVersion: typeof loadStateVersion;
    getPendingRollRequest: typeof getPendingRollRequest;
    validateActionIntent: typeof validateActionIntent;
    savePendingRollRequest: typeof savePendingRollRequest;
    applyResultingStateDelta: typeof applyResultingStateDelta;
    incrementStateVersion: typeof incrementStateVersion;
    logAppliedDelta: typeof logAppliedDelta;
    recordDamage: typeof recordDamage;
    recordHealing: typeof recordHealing;
    recordSpellSlotUse: typeof recordSpellSlotUse;
    recordRestMetric: typeof recordRestMetric;
    beginActionPhase: typeof beginActionPhase;
    advanceActionPhase: typeof advanceActionPhase;
    clearActionPhase: typeof clearActionPhase;
};

const defaultDeps: ActionServiceDeps = {
    validateAndPersistActionCursor,
    heartbeatSessionLeaseOrThrow,
    loadStateVersion,
    getPendingRollRequest,
    validateActionIntent,
    savePendingRollRequest,
    applyResultingStateDelta,
    incrementStateVersion,
    logAppliedDelta,
    recordDamage,
    recordHealing,
    recordSpellSlotUse,
    recordRestMetric,
    beginActionPhase,
    advanceActionPhase,
    clearActionPhase,
};

export const createProcessActionIntent = (overrides?: Partial<ActionServiceDeps>) => {
    const deps: ActionServiceDeps = { ...defaultDeps, ...(overrides ?? {}) };
    return async ({
        sessionId,
        userId,
        body,
    }: ProcessActionInput) => {
        await deps.validateAndPersistActionCursor({
        sessionId,
        userId,
        incomingCursor: body.actionCursor ?? null,
    });

        await deps.heartbeatSessionLeaseOrThrow({
        sessionId,
        userId,
        clientInstanceId: body.clientInstanceId,
    });

        const stateVersion = await deps.loadStateVersion(sessionId);
    if (
        typeof body.clientStateVersion === 'number' &&
        body.clientStateVersion !== stateVersion
    ) {
        throw createError(409, 'STATE_DESYNC');
    }

        const pendingRoll = await deps.getPendingRollRequest(sessionId);
    if (pendingRoll) {
        throw createError(409, 'Há rolagens pendentes para esta sessão.');
    }

    const actionId = body.actionId || uuidv4();
    let phaseAcquired = false;
    registerActionIntentTelemetry(
        sessionId,
        actionId,
        computeIntentHash({ intent: body.intent, prompt: body.prompt })
    );

        try {
            await deps.beginActionPhase({ sessionId, userId, actionId });
        phaseAcquired = true;

            await deps.advanceActionPhase({ sessionId, userId, actionId, phase: 'NORMALIZED' });

        if (body.intent) {
                await deps.advanceActionPhase({ sessionId, userId, actionId, phase: 'RULES' });

                const { result } = await deps.validateActionIntent(sessionId, userId, body.intent, {
                combatState: body.combatState,
            });

            if (body.intent.type === 'travel') {
                if (result.status === 'rejected') {
                    throw createError(400, result.reason ?? 'Viagem rejeitada pelo motor.');
                }
                const transition = await applyRegionTransition(sessionId, userId, body.intent.payload);
                await deps.incrementStateVersion(sessionId);
                if (!body.apiKey) {
                    throw createError(400, 'apiKey é obrigatória para narrar a chegada.');
                }
                await deps.advanceActionPhase({ sessionId, userId, actionId, phase: 'AI_SYNTHESIS' });
                const travelPrompt = body.prompt?.trim()
                    || `[Motor] Chegada em ${transition.regionName}${transition.poiName ? ` (${transition.poiName})` : ''}.`;
                const response = await NarrarService.processPlayerTurn(
                    sessionId,
                    userId,
                    travelPrompt,
                    body.apiKey,
                    body.combatState ?? undefined,
                    body.useAiHomebrew,
                    transition.stateHints,
                    actionId,
                );
                const newVersion = await deps.incrementStateVersion(sessionId);
                await deps.advanceActionPhase({ sessionId, userId, actionId, phase: 'DELTA_APPLIED' });
                return {
                    actionResolution: {
                        actionId,
                        stateVersion: newVersion,
                        status: 'accepted',
                        rule: 'travel',
                        result: response,
                    },
                    gameStateUpdate: {
                        ...response,
                        stateVersion: newVersion,
                    },
                };
            }

            if (result.status === 'rejected') {
                throw createError(400, result.reason ?? 'Intent inválida segundo o motor.');
            }

            if (result.status === 'needs_roll' && result.rollRequest) {
            const rollTypeMap: Record<ActionIntent['type'], PlayerRollRequest['rollType']> = {
                'weapon-attack': 'attack',
                'skill-check': 'check',
                'spell-attack': 'attack',
                rest: 'check',
                damage: 'damage',
                healing: 'healing',
                'consume-item': 'check',
                travel: 'check',
            };
            const mergedMetadata = {
                ...(result.rollRequest.metadata ?? {}),
                ...(result.data ?? {}),
                ...(result.stateDelta?.pendingAttack ? { pendingAttack: result.stateDelta.pendingAttack } : {}),
            };

            const converted = convertRollRequestToPlayerRoll(result.rollRequest, {
                rollType: rollTypeMap[body.intent.type] ?? 'check',
                reasonPrefix: 'Motor de Regras',
                metadata: mergedMetadata,
            });
            converted.requestId = uuidv4();
                await deps.savePendingRollRequest(
                sessionId,
                userId,
                converted,
                {
                    actionId,
                    intentType: body.intent.type,
                    intentPayload: body.intent.payload,
                    metadata: mergedMetadata,
                }
            );

                const payload = {
                    actionResolution: {
                        actionId,
                        stateVersion,
                        status: 'needs_roll',
                        rule: body.intent.type,
                        rollRequest: converted,
                    },
                    gameStateUpdate: {
                        stateVersion,
                        playerRollRequest: converted,
                    },
                };
                return payload;
            }

            if (result.status === 'accepted' && result.stateDelta) {
                    const applied = await deps.applyResultingStateDelta(sessionId, result.stateDelta, {
                    actionId,
                    actionType: body.intent.type,
                    expectedStateVersion: stateVersion,
                    authoritativeSignature: result.authoritativeSignature ?? null,
                });
                    const newVersion = await deps.incrementStateVersion(sessionId);
                if (applied.appliedDelta) {
                        await deps.logAppliedDelta({
                        sessionId,
                        actionId,
                        stateVersion: newVersion,
                        delta: applied.appliedDelta as Record<string, unknown>,
                        metrics: applied.metrics,
                    });
                }
                    deps.recordDamage(applied.metrics.damage);
                    deps.recordHealing(applied.metrics.healing);
                    deps.recordSpellSlotUse(applied.metrics.spellSlotsUsed);
                    deps.recordRestMetric(applied.metrics.restType);

                    await deps.advanceActionPhase({ sessionId, userId, actionId, phase: 'DELTA_APPLIED' });

                return {
                    actionResolution: {
                        actionId,
                        stateVersion: newVersion,
                        status: 'accepted',
                        stateDelta: result.stateDelta,
                        result: {
                            updatedCharacter: applied.updatedCharacter,
                            updatedEntities: applied.updatedEntities,
                        },
                    },
                    gameStateUpdate: {
                        stateVersion: newVersion,
                        updatedCharacter: applied.updatedCharacter,
                        updatedEntities: applied.updatedEntities,
                        stateDelta: result.stateDelta,
                    },
                };
            }
        }

        if (!body.intent) {
            await deps.advanceActionPhase({ sessionId, userId, actionId, phase: 'RULES' });
        }

        if (!body.prompt || !body.apiKey) {
            throw createError(400, 'Prompt e apiKey são obrigatórios quando não há intent estruturado.');
        }

            await deps.advanceActionPhase({ sessionId, userId, actionId, phase: 'AI_SYNTHESIS' });

        const response = await NarrarService.processPlayerTurn(
            sessionId,
            userId,
            body.prompt,
            body.apiKey,
            body.combatState ?? undefined,
            body.useAiHomebrew,
            undefined,
            actionId
        );
            const newVersion = await deps.incrementStateVersion(sessionId);

            await deps.advanceActionPhase({ sessionId, userId, actionId, phase: 'DELTA_APPLIED' });

        return {
            actionResolution: {
                actionId,
                stateVersion: newVersion,
                status: 'accepted',
                result: response,
            },
            gameStateUpdate: {
                ...response,
                stateVersion: newVersion,
            },
        };
        } finally {
        if (phaseAcquired) {
            await deps.clearActionPhase({ sessionId, actionId });
        }
        clearActionTelemetry(sessionId, actionId);
    }
};
};

export const processActionIntent = createProcessActionIntent();
