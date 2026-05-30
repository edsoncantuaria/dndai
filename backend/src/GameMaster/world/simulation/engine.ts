import { PenaiDataSource } from '../../database/data-source.js';
import { GameSession } from '../../database/entities/GameSession.js';
import { runRumorTick } from './ticks/rumorTick.js';
import { runFactionTick } from './ticks/factionTick.js';
import { runNpcTick } from './ticks/npcTick.js';
import { runEconomyTick } from './ticks/economyTick.js';
import { runRegionStateTick } from './ticks/regionStateTick.js';
import { runQuestTick } from './ticks/questTick.js';
import { projectSessionWorldState } from '../../events/projector.js';

export type SimulationTickResult = {
    pulses: string[];
    projected: Awaited<ReturnType<typeof projectSessionWorldState>>;
};

/** Orquestrador de simulação offline — emite eventos, projector materializa read models. */
export async function tickWorldSimulation(sessionId: number): Promise<SimulationTickResult> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    const regionSlug = session?.currentRegionSlug ?? null;

    const pulses: string[] = [];
    pulses.push(...(await runRumorTick(sessionId, regionSlug)));
    pulses.push(...(await runFactionTick(sessionId)));
    pulses.push(...(await runNpcTick(sessionId)));
    pulses.push(...(await runEconomyTick(sessionId)));
    pulses.push(...(await runRegionStateTick(sessionId)));
    pulses.push(...(await runQuestTick(sessionId)));

    const projected = await projectSessionWorldState(sessionId);
    return { pulses, projected };
}

/** @deprecated use tickWorldSimulation */
export async function tickOfflineWorld(sessionId: number): Promise<string[]> {
    const result = await tickWorldSimulation(sessionId);
    return result.pulses;
}
