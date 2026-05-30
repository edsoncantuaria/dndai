import { PenaiDataSource } from '../../GameMaster/database/data-source.js';
import { WorldShard } from '../../GameMaster/database/entities/WorldShard.js';
import { GameSession } from '../../GameMaster/database/entities/GameSession.js';
import { runAgentEngineBatch } from '../../GameMaster/agents/agentEngine.js';
import { tickWorldSimulation } from '../../GameMaster/world/simulation/engine.js';

/** Tick de shard idle — sessões ativas no shard recebem simulação leve (P12). */
export async function runShardBackgroundTickActivity(shardId: string): Promise<string[]> {
    const sessions = await PenaiDataSource.getRepository(GameSession).find({
        where: { shardId },
        take: 20,
    });
    if (!sessions.length) return [];

    const lines: string[] = [];
    const sessionId = sessions[0].id;
    const { pulses } = await tickWorldSimulation(sessionId, { logTicks: false });
    lines.push(...pulses.slice(0, 4));
    lines.push(...(await runAgentEngineBatch(sessionId)));
    return lines;
}

export async function listActiveShardIds(limit = 10): Promise<string[]> {
    const shards = await PenaiDataSource.getRepository(WorldShard).find({ take: limit });
    return shards.map(s => s.id);
}
