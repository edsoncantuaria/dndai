import { applyResultingStateDelta } from './stateDeltaService.js';
import { validateActionIntent, type ActionIntent } from '../rules/actionIntentService.js';
import {
    completeRollAndNarrate,
    isDmAutoRollEnabled,
    issuePendingRollToPlayer,
    ruleResultToPlayerRoll,
} from './dm/dmTurnOrchestrator.js';
import { v4 as uuidv4 } from 'uuid';
import { incrementStateVersion, loadStateVersion } from './stateVersionService.js';
import { savePendingRollRequest, getPendingRollRequest } from './rollRequestService.js';
import * as NarrarService from './narrarService.js';
import {
    claimPendingLoot,
    equipInventoryItem,
    inventoryStateToCharacterPatch,
} from './inventoryMotorService.js';
import { enrichUpdatedCharacterInventory } from './inventoryService.js';
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import createError from 'http-errors';
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

            if (body.intent.type === 'equip-item') {
                if (result.status === 'rejected') {
                    throw createError(400, result.reason ?? 'Equipar item rejeitado pelo motor.');
                }
                const inventoryState = await equipInventoryItem(
                    sessionId,
                    userId,
                    body.intent.payload.itemId,
                    body.intent.payload.equipped,
                );
                const newVersion = await deps.incrementStateVersion(sessionId);
                await deps.advanceActionPhase({ sessionId, userId, actionId, phase: 'DELTA_APPLIED' });
                const patch = inventoryStateToCharacterPatch(inventoryState);
                return {
                    actionResolution: {
                        actionId,
                        stateVersion: newVersion,
                        status: 'accepted',
                        rule: 'equip-item',
                        result: { updatedCharacter: patch },
                    },
                    gameStateUpdate: {
                        updatedCharacter: patch,
                        stateVersion: newVersion,
                    },
                };
            }

            if (body.intent.type === 'claim-loot') {
                if (result.status === 'rejected') {
                    throw createError(400, result.reason ?? 'Coleta de loot rejeitada.');
                }
                const inventoryState = await claimPendingLoot(sessionId, userId);
                const newVersion = await deps.incrementStateVersion(sessionId);
                const patch = inventoryStateToCharacterPatch(inventoryState);
                if (body.apiKey && body.prompt?.trim()) {
                    await deps.advanceActionPhase({ sessionId, userId, actionId, phase: 'AI_SYNTHESIS' });
                    const response = await NarrarService.processPlayerTurn(
                        sessionId,
                        userId,
                        body.prompt,
                        body.apiKey,
                        body.combatState ?? undefined,
                        body.useAiHomebrew,
                        ['[Motor] Loot coletado e registrado no inventário.'],
                        actionId,
                    );
                    const narratedVersion = await deps.incrementStateVersion(sessionId);
                    await deps.advanceActionPhase({ sessionId, userId, actionId, phase: 'DELTA_APPLIED' });
                    return {
                        actionResolution: {
                            actionId,
                            stateVersion: narratedVersion,
                            status: 'accepted',
                            rule: 'claim-loot',
                            result: { ...response, updatedCharacter: { ...(response.updatedCharacter || {}), ...patch } },
                        },
                        gameStateUpdate: {
                            ...response,
                            updatedCharacter: { ...(response.updatedCharacter || {}), ...patch },
                            stateVersion: narratedVersion,
                        },
                    };
                }
                await deps.advanceActionPhase({ sessionId, userId, actionId, phase: 'DELTA_APPLIED' });
                return {
                    actionResolution: {
                        actionId,
                        stateVersion: newVersion,
                        status: 'accepted',
                        rule: 'claim-loot',
                        result: { updatedCharacter: patch },
                    },
                    gameStateUpdate: {
                        updatedCharacter: patch,
                        stateVersion: newVersion,
                    },
                };
            }

            if (body.intent.type === 'open-shop') {
                if (result.status === 'rejected') {
                    throw createError(400, result.reason ?? 'Abrir loja rejeitado.');
                }
                const { openMotorShop } = await import('./shopMotorService.js');
                const shopState = await openMotorShop(sessionId, userId, body.intent.payload);
                const newVersion = await deps.incrementStateVersion(sessionId);
                await deps.advanceActionPhase({ sessionId, userId, actionId, phase: 'DELTA_APPLIED' });
                return {
                    actionResolution: {
                        actionId,
                        stateVersion: newVersion,
                        status: 'accepted',
                        rule: 'open-shop',
                        result: { shopState },
                    },
                    gameStateUpdate: { shopState, stateVersion: newVersion },
                };
            }

            if (body.intent.type === 'buy-item') {
                if (result.status === 'rejected') {
                    throw createError(400, result.reason ?? 'Compra rejeitada.');
                }
                const { buyFromMotorShop } = await import('./shopMotorService.js');
                const { shopState, patch } = await buyFromMotorShop(sessionId, userId, body.intent.payload);
                const newVersion = await deps.incrementStateVersion(sessionId);
                await deps.advanceActionPhase({ sessionId, userId, actionId, phase: 'DELTA_APPLIED' });
                return {
                    actionResolution: {
                        actionId,
                        stateVersion: newVersion,
                        status: 'accepted',
                        rule: 'buy-item',
                        result: { shopState, updatedCharacter: patch },
                    },
                    gameStateUpdate: {
                        shopState,
                        updatedCharacter: patch,
                        stateVersion: newVersion,
                    },
                };
            }

            if (body.intent.type === 'close-shop') {
                if (result.status === 'rejected') {
                    throw createError(400, result.reason ?? 'Fechar loja rejeitado.');
                }
                const { closeMotorShop } = await import('./shopMotorService.js');
                await closeMotorShop(sessionId, userId);
                const newVersion = await deps.incrementStateVersion(sessionId);
                await deps.advanceActionPhase({ sessionId, userId, actionId, phase: 'DELTA_APPLIED' });
                return {
                    actionResolution: {
                        actionId,
                        stateVersion: newVersion,
                        status: 'accepted',
                        rule: 'close-shop',
                        result: { shopState: null },
                    },
                    gameStateUpdate: { shopState: null, stateVersion: newVersion },
                };
            }

            if (body.intent.type === 'sell-item') {
                if (result.status === 'rejected') {
                    throw createError(400, result.reason ?? 'Venda rejeitada.');
                }
                const { sellToMotorShop } = await import('./shopMotorService.js');
                const { shopState, patch } = await sellToMotorShop(sessionId, userId, body.intent.payload);
                const newVersion = await deps.incrementStateVersion(sessionId);
                await deps.advanceActionPhase({ sessionId, userId, actionId, phase: 'DELTA_APPLIED' });
                return {
                    actionResolution: {
                        actionId,
                        stateVersion: newVersion,
                        status: 'accepted',
                        rule: 'sell-item',
                        result: { shopState, updatedCharacter: patch },
                    },
                    gameStateUpdate: {
                        shopState,
                        updatedCharacter: patch,
                        stateVersion: newVersion,
                    },
                };
            }

            if (body.intent.type === 'quest-complete') {
                if (result.status === 'rejected') {
                    throw createError(400, result.reason ?? 'Missão rejeitada.');
                }
                const { completeQuestMotor } = await import('./questMotorService.js');
                const questResult = await completeQuestMotor(sessionId, userId, body.intent.payload ?? {});
                const newVersion = await deps.incrementStateVersion(sessionId);
                await deps.advanceActionPhase({ sessionId, userId, actionId, phase: 'DELTA_APPLIED' });
                const progressionFeed = [
                    {
                        type: 'xp_gain' as const,
                        xp: questResult.xpAwarded,
                        summary: `+${questResult.xpAwarded} XP — missão concluída`,
                        source: 'motor-quest',
                    },
                ];
                if (body.apiKey?.trim() && body.prompt?.trim()) {
                    await deps.advanceActionPhase({ sessionId, userId, actionId, phase: 'AI_SYNTHESIS' });
                    const response = await NarrarService.processPlayerTurn(
                        sessionId,
                        userId,
                        body.prompt,
                        body.apiKey,
                        body.combatState ?? undefined,
                        body.useAiHomebrew,
                        [`[Motor] Missão concluída: +${questResult.xpAwarded} XP.`],
                        actionId,
                    );
                    const narratedVersion = await deps.incrementStateVersion(sessionId);
                    return {
                        actionResolution: {
                            actionId,
                            stateVersion: narratedVersion,
                            status: 'accepted',
                            rule: 'quest-complete',
                            result: { ...response, progressionFeed },
                        },
                        gameStateUpdate: { ...response, progressionFeed, stateVersion: narratedVersion },
                    };
                }
                return {
                    actionResolution: {
                        actionId,
                        stateVersion: newVersion,
                        status: 'accepted',
                        rule: 'quest-complete',
                        result: { progressionFeed },
                    },
                    gameStateUpdate: { progressionFeed, stateVersion: newVersion },
                };
            }

            if (body.intent.type === 'start-encounter') {
                if (result.status === 'rejected') {
                    throw createError(400, result.reason ?? 'Início de encontro rejeitado.');
                }
                const { startMotorEncounter } = await import('./startEncounterService.js');
                const encounter = await startMotorEncounter(sessionId, body.intent.payload);
                const newVersion = await deps.incrementStateVersion(sessionId);
                await deps.advanceActionPhase({ sessionId, userId, actionId, phase: 'DELTA_APPLIED' });
                if (body.apiKey?.trim() && body.prompt?.trim()) {
                    await deps.advanceActionPhase({ sessionId, userId, actionId, phase: 'AI_SYNTHESIS' });
                    const response = await NarrarService.processPlayerTurn(
                        sessionId,
                        userId,
                        body.prompt,
                        body.apiKey,
                        encounter.combatState,
                        body.useAiHomebrew,
                        ['[Motor] Encontro de combate iniciado.'],
                        actionId,
                    );
                    const narratedVersion = await deps.incrementStateVersion(sessionId);
                    return {
                        actionResolution: {
                            actionId,
                            stateVersion: narratedVersion,
                            status: 'accepted',
                            rule: 'start-encounter',
                            result: { ...response, combatState: encounter.combatState },
                        },
                        gameStateUpdate: {
                            ...response,
                            combatState: encounter.combatState,
                            stateVersion: narratedVersion,
                        },
                    };
                }
                return {
                    actionResolution: {
                        actionId,
                        stateVersion: newVersion,
                        status: 'accepted',
                        rule: 'start-encounter',
                        result: { combatState: encounter.combatState },
                    },
                    gameStateUpdate: {
                        combatState: encounter.combatState,
                        stateVersion: newVersion,
                    },
                };
            }

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
            const mergedMetadata = {
                ...(result.rollRequest.metadata ?? {}),
                ...(result.data ?? {}),
                ...(result.stateDelta?.pendingAttack ? { pendingAttack: result.stateDelta.pendingAttack } : {}),
                playerAction: body.prompt?.slice(0, 300) ?? '',
            };

            const converted = ruleResultToPlayerRoll(body.intent, result);
            if (!converted) {
                throw createError(500, 'Falha ao converter pedido de rolagem.');
            }
            converted.requestId = uuidv4();

            if (isDmAutoRollEnabled() && body.apiKey?.trim()) {
                await deps.advanceActionPhase({ sessionId, userId, actionId, phase: 'AI_SYNTHESIS' });
                const response = await completeRollAndNarrate({
                    sessionId,
                    userId,
                    apiKey: body.apiKey,
                    playerAction: body.prompt?.trim() || converted.reason,
                    rollRequest: converted,
                    combatState: body.combatState ?? null,
                    useAiHomebrew: body.useAiHomebrew,
                    actionId,
                    intentType: body.intent.type,
                    intentPayload: body.intent.payload,
                    metadata: mergedMetadata,
                });
                const newVersion = await deps.incrementStateVersion(sessionId);
                await deps.advanceActionPhase({ sessionId, userId, actionId, phase: 'DELTA_APPLIED' });
                return {
                    actionResolution: {
                        actionId,
                        stateVersion: newVersion,
                        status: 'accepted',
                        rule: body.intent.type,
                        result: response,
                        autoRoll: true,
                    },
                    gameStateUpdate: {
                        ...response,
                        stateVersion: newVersion,
                    },
                };
            }

            const rollResponse = await issuePendingRollToPlayer({
                sessionId,
                userId,
                rollRequest: converted,
                actionId,
                intentType: body.intent.type,
                intentPayload: body.intent.payload,
                metadata: mergedMetadata,
                playerAction: body.prompt?.trim(),
            });

            const rollRequest =
                rollResponse.playerRollRequest ?? { ...converted, requestId: converted.requestId! };

            return {
                actionResolution: {
                    actionId,
                    stateVersion,
                    status: 'needs_roll',
                    rule: body.intent.type,
                    rollRequest,
                },
                gameStateUpdate: {
                    ...rollResponse,
                    stateVersion,
                    playerRollRequest: rollRequest,
                },
            };
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

                let inventoryPatch = {};
                if (AppDataSource.isInitialized) {
                    const sessaoRepo = AppDataSource.getRepository(SessaoIA);
                    const sessaoWithChar = await sessaoRepo.findOne({
                        where: { id: sessionId },
                        relations: ['character', 'character.attributes'],
                    });
                    if (sessaoWithChar?.character) {
                        const authState = await enrichUpdatedCharacterInventory(
                            sessaoWithChar.character.id,
                            sessaoWithChar.character.attributes?.strength,
                        );
                        inventoryPatch = inventoryStateToCharacterPatch(authState);
                    }
                }

                let motorExtras: Record<string, unknown> = {};
                try {
                    const sessaoRepo = AppDataSource.getRepository(SessaoIA);
                    const sessaoRow = await sessaoRepo.findOne({
                        where: { id: sessionId },
                        select: ['id', 'characterId'],
                    });
                    const { postMotorCombatSync } = await import('./combatMotorService.js');
                    const motorSync = await postMotorCombatSync(sessionId, {
                        clientCombat: body.combatState ?? undefined,
                        characterId: sessaoRow?.characterId ?? undefined,
                    });
                    if (motorSync?.publicState !== undefined) {
                        motorExtras.combatState = motorSync.publicState;
                    }
                    if (motorSync?.rewards?.lootOffer) {
                        motorExtras.lootOffer = motorSync.rewards.lootOffer;
                    }
                } catch (motorErr) {
                    console.warn('[actionService] postMotorCombatSync:', motorErr);
                }

                return {
                    actionResolution: {
                        actionId,
                        stateVersion: newVersion,
                        status: 'accepted',
                        stateDelta: result.stateDelta,
                        result: {
                            updatedCharacter: {
                                ...(applied.updatedCharacter as object || {}),
                                ...inventoryPatch,
                            },
                            updatedEntities: applied.updatedEntities,
                            ...motorExtras,
                        },
                    },
                    gameStateUpdate: {
                        stateVersion: newVersion,
                        updatedCharacter: {
                            ...(applied.updatedCharacter as object || {}),
                            ...inventoryPatch,
                        },
                        updatedEntities: applied.updatedEntities,
                        stateDelta: result.stateDelta,
                        ...motorExtras,
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

        const { processFreeActionWithDmFlow } = await import('./dm/dmTurnOrchestrator.js');
        const response = await processFreeActionWithDmFlow({
            sessionId,
            userId,
            playerAction: body.prompt,
            apiKey: body.apiKey,
            combatState: body.combatState ?? null,
            useAiHomebrew: body.useAiHomebrew,
            actionId,
        });
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
