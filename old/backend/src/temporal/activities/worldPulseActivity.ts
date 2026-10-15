import { publishWorldPulse } from '../../GameMaster/world/publishWorldPulse.js';

/** Activity Temporal — simulação + narrador Gemini + WS. */
export async function projectWorldPulse(sessionId: number): Promise<string[]> {
    return publishWorldPulse(sessionId);
}
