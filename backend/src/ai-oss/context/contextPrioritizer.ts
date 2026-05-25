/**
 * Ordem de prioridade para montagem de contexto (Fase 1: documentação + trim).
 * Fase 2: compressor real e embeddings.
 */
export const CONTEXT_PRIORITY = [
    'current_scene',
    'last_player_action',
    'active_combat',
    'nearby_npcs',
    'active_quests',
    'relevant_memories',
    'distant_lore',
] as const;

export type ContextChunk = {
    kind: (typeof CONTEXT_PRIORITY)[number];
    text: string;
    priority: number;
};

export function sortContextChunks(chunks: ContextChunk[]): ContextChunk[] {
    return [...chunks].sort((a, b) => a.priority - b.priority);
}

/** Limita tamanho total aproximado em caracteres (~tokens/4). */
export function trimContextBudget(chunks: ContextChunk[], maxChars: number): string {
    const sorted = sortContextChunks(chunks);
    const parts: string[] = [];
    let used = 0;
    for (const chunk of sorted) {
        const piece = `[${chunk.kind}] ${chunk.text}\n`;
        if (used + piece.length > maxChars) break;
        parts.push(piece);
        used += piece.length;
    }
    return parts.join('').trim();
}
