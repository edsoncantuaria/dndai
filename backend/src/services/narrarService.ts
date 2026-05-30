/**
 * @deprecated Legado — delega ao PENAI GameMaster.turnPipeline / Temporal.
 */
import { runTurnPipeline } from '../GameMaster/engine/turnPipeline.js';
import { startNarrationWorkflow } from '../temporal/client.js';
import { allocateActionSequence } from '../GameMaster/sessions/sessionService.js';
import { randomUUID } from 'crypto';

export async function processPlayerTurn(opts: {
    sessionId: number;
    userId: number;
    playerAction: string;
    actionId?: string;
    rollSummary?: string;
}): Promise<{ narration: string }> {
    const actionSequence = await allocateActionSequence(opts.sessionId);
    const actionId = opts.actionId ?? randomUUID();
    const wf = await startNarrationWorkflow({
        sessionId: opts.sessionId,
        userId: opts.userId,
        playerAction: opts.playerAction,
        actionSequence,
        actionId,
        rollSummary: opts.rollSummary,
    });
    if (wf.sync) {
        const result = await runTurnPipeline({
            sessionId: opts.sessionId,
            userId: opts.userId,
            playerAction: opts.playerAction,
            actionSequence,
            actionId,
            rollSummary: opts.rollSummary,
        });
        return { narration: result.narration };
    }
    return { narration: '' };
}
