import { proxyActivities, sleep } from '@temporalio/workflow';
import type * as activities from '../activities/worldPulseActivity.js';

const { projectWorldPulse } = proxyActivities<typeof activities>({
    startToCloseTimeout: '2 minutes',
});

export async function worldPulseWorkflow(sessionId: number): Promise<string[]> {
    await sleep(100);
    return projectWorldPulse(sessionId);
}
