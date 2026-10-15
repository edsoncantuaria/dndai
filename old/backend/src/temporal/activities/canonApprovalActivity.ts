import { approveCanonProposal } from '../../GameMaster/admin/canonApproval.js';

export async function persistCanonApproval(proposalId: string): Promise<string> {
    const result = await approveCanonProposal(proposalId);
    return result.ok ? 'approved' : `failed:${result.message}`;
}
