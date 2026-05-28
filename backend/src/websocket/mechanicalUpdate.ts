import type { WebSocket } from 'ws';
import type { GameMasterResponse } from '../schemas/gameSchemas.js';
import { recordGameEvent } from '../events/recordGameEvent.js';
import { recordMechanicalLatencyMs } from '../telemetry/pipelineLatency.js';

/** Payload mecânico sem exigir narração (subset de GameMasterResponse). */
export type MechanicalStatePayload = {
    stateVersion: number;
    actionSequence?: number;
    actionId?: string;
    updatedCharacter?: GameMasterResponse['updatedCharacter'];
    updatedEntities?: unknown[];
    combatState?: GameMasterResponse['combatState'];
    playerRollRequest?: GameMasterResponse['playerRollRequest'];
    lootOffer?: GameMasterResponse['lootOffer'];
    attackOutcome?: { hit?: boolean };
};

export function buildMechanicalPayload(params: {
    stateVersion: number;
    actionSequence?: number;
    actionId?: string;
    resolutionResult?: {
        updatedCharacter?: unknown;
        updatedEntity?: unknown;
        attackOutcome?: { hit?: boolean };
    } | null;
    combatState?: GameMasterResponse['combatState'];
    playerRollRequest?: GameMasterResponse['playerRollRequest'];
    lootOffer?: GameMasterResponse['lootOffer'];
}): MechanicalStatePayload {
    const { stateVersion, actionId, resolutionResult, combatState, playerRollRequest, lootOffer } =
        params;
    return {
        stateVersion,
        ...(params.actionSequence != null ? { actionSequence: params.actionSequence } : {}),
        ...(actionId ? { actionId } : {}),
        ...(resolutionResult?.updatedCharacter
            ? { updatedCharacter: resolutionResult.updatedCharacter as MechanicalStatePayload['updatedCharacter'] }
            : {}),
        ...(resolutionResult?.updatedEntity ? { updatedEntities: [resolutionResult.updatedEntity] } : {}),
        ...(resolutionResult?.attackOutcome ? { attackOutcome: resolutionResult.attackOutcome } : {}),
        ...(combatState !== undefined ? { combatState } : {}),
        ...(playerRollRequest !== undefined ? { playerRollRequest } : {}),
        ...(lootOffer !== undefined ? { lootOffer } : {}),
    };
}

/**
 * Envia atualização mecânica imediata ao cliente (antes da narração LLM).
 * Narração pode chegar depois via gameStateUpdate / narrationStream.
 */
export async function emitMechanicalStateUpdate(
    ws: WebSocket,
    sessionId: number,
    payload: MechanicalStatePayload,
    opts?: { resolutionLatencyMs?: number },
): Promise<boolean> {
    if (typeof opts?.resolutionLatencyMs === 'number' && opts.resolutionLatencyMs >= 0) {
        recordMechanicalLatencyMs(opts.resolutionLatencyMs);
    }

    ws.send(
        JSON.stringify({
            type: 'mechanicalStateUpdate',
            payload,
        }),
    );

    await recordGameEvent({
        sessionId,
        actionId: payload.actionId ?? null,
        type: 'MechanicalUpdateEmitted',
        stateVersion: payload.stateVersion,
        payload: {
            hasCharacter: Boolean(payload.updatedCharacter),
            hasCombat: Boolean(payload.combatState),
            hasRollRequest: Boolean(payload.playerRollRequest),
        },
    }).catch(err => {
        console.warn('[mechanicalUpdate] Falha ao registrar evento:', err);
    });

    return true;
}
