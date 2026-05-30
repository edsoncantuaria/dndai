import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities/campaignGcActivity.js';

const { runCampaignGcActivity } = proxyActivities<typeof activities>({
    startToCloseTimeout: '2 minutes',
});

export async function campaignGcWorkflow(sessionId: number): Promise<string> {
    return runCampaignGcActivity(sessionId);
}
