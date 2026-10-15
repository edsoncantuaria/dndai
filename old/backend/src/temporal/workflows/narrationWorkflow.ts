import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities/runTurnPipeline.js';

const { runTurnPipelineActivity } = proxyActivities<typeof activities>({
    startToCloseTimeout: '3 minutes',
    /** 1 tentativa — sem reexecutar turno e queimar tokens Gemini. */
    retry: { maximumAttempts: 1 },
});

export type NarrationWorkflowInput = {
    sessionId: number;
    userId: number;
    playerAction: string;
    actionSequence: number;
    actionId: string;
    rollSummary?: string;
    motorHints?: string[];
    intentType?: string;
};

export async function narrationWorkflow(input: NarrationWorkflowInput): Promise<{ narration: string }> {
    return runTurnPipelineActivity(input);
}
