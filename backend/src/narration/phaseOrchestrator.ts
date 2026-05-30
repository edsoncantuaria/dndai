/** @deprecated — PENAI usa GameMaster.engine/turnPipeline */
import { runTurnPipeline } from '../GameMaster/engine/turnPipeline.js';

export async function runAiPhases(ctx: {
    sessionId: number;
    userId: number;
    playerAction: string;
    actionId: string;
    actionSequence: number;
}): Promise<{ response: { logEntries: Array<{ type: string; content: string }> } }> {
    const result = await runTurnPipeline(ctx);
    return {
        response: {
            logEntries: [{ type: 'narrative', content: result.narration }],
        },
    };
}
