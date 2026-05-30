import { randomUUID } from 'crypto';
import {
    clearPendingPenaiRoll,
    getPendingPenaiRoll,
    savePendingPenaiRoll,
    type StoredPenaiRoll,
} from './penaiRollStore.js';
import { appendWorldEvent } from '../events/store.js';
import { resolvePenaiStructuredRoll } from '../combat/penaiRollResolution.js';
import { advancePenaiCombatPhaseAfterRoll } from '../combat/combatPhasePenai.js';
import { bumpSessionStateVersion } from '../character/applyStateDeltaPenai.js';
import type { PenaiRollResolveResult, PenaiRollSubmitInput } from './types.js';

function computeRollTotal(pending: StoredPenaiRoll, rolls: number[], rawRoll?: number): number {
    const base =
        rawRoll ??
        (rolls.length ? rolls.reduce((a, b) => a + b, 0) : 0);
    return base + (pending.modifier ?? 0);
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

    const finalTotal = computeRollTotal(pending, input.rolls, input.rawRoll);
    const dc = pending.dc;
    const success = dc != null ? finalTotal >= dc : true;

    const rollSummary = `Rolagem ${pending.dice}: [${input.rolls.join(', ')}] + ${pending.modifier ?? 0} = ${finalTotal}${
        dc != null ? ` (CD ${dc}: ${success ? 'sucesso' : 'falha'})` : ''
    }`;

    const resolutionResult = await resolvePenaiStructuredRoll(input.sessionId, pending, {
        total: finalTotal,
        rawRoll: input.rolls[0] ?? input.rawRoll ?? finalTotal,
        diceValues: input.rolls,
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
            rolls: input.rolls,
            total: finalTotal,
            success,
            hit: resolutionResult?.attackOutcome?.hit,
            deferNarration: Boolean(resolutionResult?.nextRollRequest),
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
        ruleCheck: {
            status: 'accepted',
            reason: rollSummary,
        },
        mechanical: {
            intentType: 'combat',
            rollResolved: true,
            rollTotal: finalTotal,
            rollSuccess: success,
            attackOutcome: resolutionResult?.attackOutcome,
            motorHints: resolutionResult?.hints,
            ...pack,
        },
    };
}
