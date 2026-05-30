import { startWorldPulseWorkflow } from '../../../temporal/client.js';

/** Macro-pulso (simulação completa + Gemini). Micro-pulso = por turno, sem LLM. */
export type WorldPulseTrigger =
    | 'travel'
    | 'long-rest'
    | 'manual'
    | 'combat_end'
    | 'quest_major'
    | 'game_day';

export async function maybeScheduleWorldPulse(
    sessionId: number,
    trigger: WorldPulseTrigger,
    meta?: Record<string, unknown>,
): Promise<void> {
    await startWorldPulseWorkflow(sessionId, trigger, meta);
}
