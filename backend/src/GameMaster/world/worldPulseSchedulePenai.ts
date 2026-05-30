import { startWorldPulseWorkflow } from '../../temporal/client.js';

/** Gatilhos que representam salto de tempo no mundo — não dispara a cada turno/ação. */
export type WorldPulseTrigger = 'travel' | 'long-rest' | 'manual';

/**
 * Agenda pulso do mundo só quando faz sentido narrativamente (tempo passou de verdade).
 * Turnos normais (exploração, combate, fala) não chamam isto — evita ruído e custo desnecessário.
 */
export async function maybeScheduleWorldPulse(
    sessionId: number,
    trigger: WorldPulseTrigger,
): Promise<void> {
    if (trigger === 'manual') {
        await startWorldPulseWorkflow(sessionId, trigger);
        return;
    }
    await startWorldPulseWorkflow(sessionId, trigger);
}
