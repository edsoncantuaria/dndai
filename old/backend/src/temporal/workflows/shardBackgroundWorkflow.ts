import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities/shardBackgroundTick.js';

const { runShardBackgroundTickActivity } = proxyActivities<typeof activities>({
    startToCloseTimeout: '3 minutes',
});

export async function shardBackgroundWorkflow(shardId: string): Promise<string[]> {
    return runShardBackgroundTickActivity(shardId);
}
