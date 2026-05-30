import { startWorldPulseWorkflow } from '../../../temporal/client.js';

/** Gatilhos que representam salto de tempo no mundo — não dispara a cada turno/ação. */
export type WorldPulseTrigger = 'travel' | 'long-rest' | 'manual';

export async function maybeScheduleWorldPulse(
    sessionId: number,
    trigger: WorldPulseTrigger,
): Promise<void> {
    await startWorldPulseWorkflow(sessionId, trigger);
}
