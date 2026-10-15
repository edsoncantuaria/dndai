import { appendWorldEvent } from '../events/store.js';
import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { listPresentEntityIds } from '../world/knowledgeGraph.js';
import { recordProvenanceFact } from '../memory/provenanceMemory.js';

export type AgentIntent = {
    npcEntityId: string;
    action: 'patrol' | 'trade' | 'warn' | 'scheme';
    targetEntityId?: string;
};

/**
 * Motor de agentes leve (P11): 1 intenção por NPC presente, cadeia mínima em eventos.
 * Expansível para GOAP completo sem LLM.
 */
export async function runAgentEngineBatch(sessionId: number): Promise<string[]> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    if (!session?.currentRegionSlug) return [];

    const npcIds = await listPresentEntityIds(sessionId, 2);
    const pulses: string[] = [];

    for (const npcEntityId of npcIds.slice(0, 2)) {
        const intent: AgentIntent = {
            npcEntityId,
            action: 'patrol',
        };

        await appendWorldEvent({
            type: 'NPC_ACTION_EXECUTED',
            sessionId,
            actorEntityId: npcEntityId,
            payload: {
                action: intent.action,
                regionSlug: session.currentRegionSlug,
                source: 'agent_engine',
            },
        });

        const line = `Um NPC na região executa ${intent.action}.`;
        pulses.push(line);
        await recordProvenanceFact({
            sessionId,
            text: line,
            regionSlug: session.currentRegionSlug,
            sourceEventType: 'NPC_ACTION_EXECUTED',
        });
    }

    return pulses;
}
