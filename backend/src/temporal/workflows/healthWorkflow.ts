import { proxyActivities, sleep } from '@temporalio/workflow';
import type * as activities from '../activities/healthActivity.js';

const { pingPenai } = proxyActivities<typeof activities>({
    startToCloseTimeout: '1 minute',
});

export async function healthWorkflow(name: string): Promise<string> {
    await sleep(50);
    return pingPenai(name);
}
