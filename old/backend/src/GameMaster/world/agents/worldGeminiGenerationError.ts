export type WorldGeminiAgentId = 'npc' | 'faction' | 'economy' | 'quest' | 'pulse';

/** Falha em agente de geração mundial — sem conteúdo local substituto. */
export class WorldGeminiGenerationError extends Error {
    readonly agent: WorldGeminiAgentId;
    readonly reason: string;

    constructor(agent: WorldGeminiAgentId, reason: string, detail: string) {
        super(detail);
        this.name = 'WorldGeminiGenerationError';
        this.agent = agent;
        this.reason = reason;
    }
}

export function failWorldGemini(
    agent: WorldGeminiAgentId,
    reason: string,
    detail: string,
): never {
    throw new WorldGeminiGenerationError(agent, reason, detail);
}
