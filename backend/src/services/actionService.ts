import { applyResultingStateDelta } from './stateDeltaService.js';
import { validateActionIntent, type ActionIntent } from '../rules/actionIntentService.js';
import { convertRollRequestToPlayerRoll } from '../rules/rollRequestAdapter.js';
import { v4 as uuidv4 } from 'uuid';
import { incrementStateVersion, loadStateVersion } from './stateVersionService.js';
import { savePendingRollRequest, getPendingRollRequest } from './rollRequestService.js';
import * as NarrarService from './narrarService.js';
import createError from 'http-errors';
import type { PlayerRollRequest } from '../types.js';
import type { CombatState } from '../schemas/gameSchemas.js';
import { logAppliedDelta } from './deltaLogger.js';
import { recordDamage, recordHealing, recordSpellSlotUse, recordRestMetric } from './deltaMetricsService.js';

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
    };
}

export const processActionIntent = async ({
    sessionId,
    userId,
    body,
}: ProcessActionInput) => {
    const stateVersion = await loadStateVersion(sessionId);
    if (
        typeof body.clientStateVersion === 'number' &&
        body.clientStateVersion !== stateVersion
    ) {
        throw createError(409, 'STATE_DESYNC');
    }

    const pendingRoll = await getPendingRollRequest(sessionId);
    if (pendingRoll) {
        throw createError(409, 'Há rolagens pendentes para esta sessão.');
    }

    let actionId = body.actionId || uuidv4();

    if (body.intent) {
        const { result } = await validateActionIntent(sessionId, userId, body.intent, {
            combatState: body.combatState,
        });

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
            };

            const converted = convertRollRequestToPlayerRoll(result.rollRequest, {
                rollType: rollTypeMap[body.intent.type] ?? 'check',
                reasonPrefix: 'Motor de Regras',
            });
            converted.requestId = uuidv4();
            await savePendingRollRequest(
                sessionId,
                userId,
                converted,
                {
                    actionId,
                    intentType: body.intent.type,
                    intentPayload: body.intent.payload,
                    metadata: result.data ?? undefined,
                }
            );

            return {
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
        }

        if (result.status === 'accepted' && result.stateDelta) {
            const applied = await applyResultingStateDelta(sessionId, result.stateDelta, {
                actionId,
                actionType: body.intent.type,
            });
            const newVersion = await incrementStateVersion(sessionId);
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

    if (!body.prompt || !body.apiKey) {
        throw createError(400, 'Prompt e apiKey são obrigatórios quando não há intent estruturado.');
    }

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
    const newVersion = await incrementStateVersion(sessionId);

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
};
