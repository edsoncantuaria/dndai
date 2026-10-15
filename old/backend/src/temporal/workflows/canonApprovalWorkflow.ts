import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities/canonApprovalActivity.js';

const { persistCanonApproval } = proxyActivities<typeof activities>({
    startToCloseTimeout: '2 minutes',
});

export async function canonApprovalWorkflow(proposalId: string): Promise<string> {
    return persistCanonApproval(proposalId);
}
