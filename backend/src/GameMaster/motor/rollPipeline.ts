import { randomUUID } from 'crypto';
import { PenaiDataSource } from '../database/data-source.js';
import {
    clearPendingPenaiRoll,
    getPendingPenaiRoll,
    savePendingPenaiRoll,
    type StoredPenaiRoll,
} from './rollStore.js';
import { appendWorldEvent } from '../events/store.js';
import { resolvePenaiStructuredRoll } from '../combat/rollResolution.js';
import { advancePenaiCombatPhaseAfterRoll } from '../combat/phaseGate.js';
import { bumpSessionStateVersion } from '../character/applyStateDelta.js';
import { executeAutomatedRoll } from '../../services/dm/autoRollService.js';
import type { PenaiRollResolveResult, PenaiRollSubmitInput } from './types.js';

/** Rolagem autoritativa no servidor — ignora valores enviados pelo cliente. */
function rollAuthoritative(pending: StoredPenaiRoll): { rolls: number[]; rawRoll: number; total: number } {
    const automated = executeAutomatedRoll({
        reason: pending.reason ?? 'Rolagem',
        dice: pending.dice ?? '1d20',
        modifier: pending.modifier ?? 0,
        dc: pending.dc,
        rollType: pending.rollType ?? 'check',
        advantage: pending.advantage,
        disadvantage: pending.disadvantage,
        requestId: pending.requestId,
        metadata: pending.metadata,
    });
    return {
        rolls: automated.diceValues,
        rawRoll: automated.rawRoll,
        total: automated.total,
    };
}

export async function resolvePenaiRoll(
    input: PenaiRollSubmitInput,
): Promise<PenaiRollResolveResult> {
    const pending = await getPendingPenaiRoll(input.sessionId);
    if (!pending) {
        return { ok: false, message: 'Nenhuma rolagem pendente nesta sessão.' };
    }

    if (pending.requestId !== input.requestId) {
        return { ok: false, message: 'requestId não corresponde à rolagem pendente.' };
    }

    if (pending.userId !== input.userId) {
        return { ok: false, message: 'Esta rolagem pertence a outro jogador.' };
    }

    const { rolls, rawRoll, total: finalTotal } = rollAuthoritative(pending);
    const dc = pending.dc;
    const success = dc != null ? finalTotal >= dc : true;

    const rollSummary = `Rolagem ${pending.dice}: [${rolls.join(', ')}] + ${pending.modifier ?? 0} = ${finalTotal}${
        dc != null ? ` (CD ${dc}: ${success ? 'sucesso' : 'falha'})` : ''
    }`;

    const resolutionResult = await resolvePenaiStructuredRoll(input.sessionId, pending, {
        total: finalTotal,
        rawRoll,
        diceValues: rolls,
    });

    if (resolutionResult) {
        await advancePenaiCombatPhaseAfterRoll(input.sessionId, {
            hasFollowUpRoll: Boolean(resolutionResult.nextRollRequest),
            shouldNarrate: resolutionResult.shouldNarrate !== false,
        });
    }

    if (resolutionResult?.updatedCharacter || resolutionResult?.updatedEntity) {
        if (PenaiDataSource.isInitialized) {
            await bumpSessionStateVersion(input.sessionId);
        }
    }

    await appendWorldEvent({
        type: 'ROLL_RESOLVED',
        sessionId: input.sessionId,
        payload: {
            requestId: input.requestId,
            actionId: pending.actionId,
            actionSequence: pending.actionSequence,
            rolls,
            total: finalTotal,
            success,
            hit: resolutionResult?.attackOutcome?.hit,
            deferNarration: Boolean(resolutionResult?.nextRollRequest),
            serverAuthoritative: true,
        },
    });

    const followUp = resolutionResult?.nextRollRequest;
    if (followUp) {
        await clearPendingPenaiRoll(input.sessionId);
        const nextRequestId = randomUUID();
        const followUpRequest = {
            ...followUp.request,
            requestId: nextRequestId,
        };
        const stored = await savePendingPenaiRoll({
            sessionId: input.sessionId,
            userId: pending.userId,
            actionId: pending.actionId,
            actionSequence: pending.actionSequence,
            playerAction: pending.playerAction,
            roll: followUpRequest,
        });

        const { formatMechanicalPack } = await import('../character/formatMechanicalPack.js');
        let pack: Record<string, unknown> = {};
        try {
            pack = await formatMechanicalPack(input.sessionId);
        } catch {
            pack = {};
        }

        return {
            ok: true,
            rollSummary,
            playerAction: pending.playerAction,
            actionId: pending.actionId,
            actionSequence: pending.actionSequence,
            deferNarration: true,
            playerRollRequest: stored,
            ruleCheck: {
                status: 'accepted',
                reason: rollSummary,
            },
            mechanical: {
                intentType: 'combat',
                rollResolved: true,
                rollTotal: finalTotal,
                rollSuccess: success,
                serverRolls: rolls,
                serverRawRoll: rawRoll,
                attackOutcome: resolutionResult?.attackOutcome,
                followUp: followUpRequest.rollType,
                motorHints: resolutionResult?.hints,
                ...pack,
            },
        };
    }

    await clearPendingPenaiRoll(input.sessionId);

    const shouldNarrate = resolutionResult?.shouldNarrate !== false;
    const { formatMechanicalPack } = await import('../character/formatMechanicalPack.js');
    let pack: Record<string, unknown> = {};
    try {
        pack = await formatMechanicalPack(input.sessionId);
    } catch {
        pack = {};
    }

    return {
        ok: true,
        rollSummary,
        playerAction: shouldNarrate ? pending.playerAction : undefined,
        actionId: pending.actionId,
        actionSequence: pending.actionSequence,
        deferNarration: !shouldNarrate,
        permanentlyDead: resolutionResult?.permanentlyDead,
        ruleCheck: {
            status: 'accepted',
            reason: rollSummary,
        },
        mechanical: {
            intentType: 'combat',
            rollResolved: true,
            rollTotal: finalTotal,
            rollSuccess: success,
            serverRolls: rolls,
            serverRawRoll: rawRoll,
            attackOutcome: resolutionResult?.attackOutcome,
            motorHints: resolutionResult?.hints,
            ...pack,
        },
    };
}
