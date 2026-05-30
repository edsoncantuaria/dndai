import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities/worldBootstrapActivity.js';

const { runWorldBootstrapActivity } = proxyActivities<typeof activities>({
    startToCloseTimeout: '15 minutes',
    heartbeatTimeout: '2 minutes',
});

export async function worldBootstrapWorkflow(sessionId: number): Promise<void> {
    await runWorldBootstrapActivity(sessionId);
}
