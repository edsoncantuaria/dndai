import { runCampaignGc } from '../../GameMaster/world/campaignGc.js';

export async function runCampaignGcActivity(sessionId: number): Promise<string> {
    const result = await runCampaignGc(sessionId);
    return `archived:${result.archived}:skipped:${result.skipped}`;
}
