import { PenaiDataSource } from '../../database/data-source.js';
import { GameSession } from '../../database/entities/GameSession.js';
import { runRumorTick } from './ticks/rumorTick.js';
import { runFactionTick } from './ticks/factionTick.js';
import { runNpcTick } from './ticks/npcTick.js';
import { runEconomyTick } from './ticks/economyTick.js';
import { runRegionStateTick } from './ticks/regionStateTick.js';
import { runQuestTick } from './ticks/questTick.js';
import { projectSessionWorldState } from '../../events/projector.js';
import { penaiPipelinePreview } from '../../infra/pipelineLog.js';
import type { PipelineCtx } from '../../infra/pipelineLog.js';

export type SimulationTickResult = {
    pulses: string[];
    projected: Awaited<ReturnType<typeof projectSessionWorldState>>;
};

/** Orquestrador de simulação offline — emite eventos, projector materializa read models. */
export async function tickWorldSimulation(
    sessionId: number,
    opts?: { logTicks?: boolean; ctx?: PipelineCtx },
): Promise<SimulationTickResult> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    const regionSlug = session?.currentRegionSlug ?? null;
    const ctx = opts?.ctx ?? { sessionId };

    const tickRuns: Array<{ name: string; lines: string[] }> = [];

    const run = async (name: string, fn: () => Promise<string[]>) => {
        const lines = await fn();
        tickRuns.push({ name, lines });
        return lines;
    };

    const pulses: string[] = [];
    pulses.push(...(await run('rumor', () => runRumorTick(sessionId, regionSlug))));
    pulses.push(...(await run('faction', () => runFactionTick(sessionId))));
    pulses.push(...(await run('npc', () => runNpcTick(sessionId))));
    pulses.push(...(await run('economy', () => runEconomyTick(sessionId))));
    pulses.push(...(await run('region', () => runRegionStateTick(sessionId))));
    pulses.push(...(await run('quest', () => runQuestTick(sessionId))));

    const projected = await projectSessionWorldState(sessionId);

    if (opts?.logTicks) {
        penaiPipelinePreview(
            'WORLD_SIM',
            'ticks concluídos',
            tickRuns.flatMap(t =>
                t.lines.length
                    ? t.lines.map((line, i) => ({ label: `${t.name}[${i}]`, preview: line }))
                    : [{ label: t.name, preview: '(sem linha)' }],
            ),
            ctx,
        );
    }

    return { pulses, projected };
}

/** @deprecated use tickWorldSimulation */
export async function tickOfflineWorld(sessionId: number): Promise<string[]> {
    const result = await tickWorldSimulation(sessionId);
    return result.pulses;
}
