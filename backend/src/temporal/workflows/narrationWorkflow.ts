import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities/runTurnPipeline.js';

const { runTurnPipelineActivity } = proxyActivities<typeof activities>({
    startToCloseTimeout: '3 minutes',
    retry: { maximumAttempts: 3 },
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
