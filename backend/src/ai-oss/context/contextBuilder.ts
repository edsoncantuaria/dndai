import type { GameMasterFlowInput } from '../../schemas/gameSchemas.js';
import { compressGameLogForOss } from '../memory/compressor.js';
import { trimContextBudget, type ContextChunk } from './contextPrioritizer.js';

const DEFAULT_MAX_CHARS = 4500;

/** Monta resumo de cena priorizado para o prompt OSS (compacto). */
export function buildOssSceneContext(input: GameMasterFlowInput, maxChars = DEFAULT_MAX_CHARS): string {
    const chunks: ContextChunk[] = [];

    if (input.storySummary?.trim()) {
        chunks.push({ kind: 'relevant_memories', text: input.storySummary.trim(), priority: 5 });
    }
    if (input.timelineFacts?.trim()) {
        chunks.push({ kind: 'active_quests', text: input.timelineFacts.trim(), priority: 4 });
    }
    if (input.layeredMemorySummary?.trim()) {
        chunks.push({ kind: 'relevant_memories', text: input.layeredMemorySummary.trim(), priority: 6 });
    }
    if (input.regionGraphSummary?.trim()) {
        chunks.push({ kind: 'current_scene', text: `Região: ${input.regionGraphSummary.trim()}`, priority: 1 });
    } else if (input.regionSlug?.trim()) {
        chunks.push({ kind: 'current_scene', text: `Região=${input.regionSlug}`, priority: 2 });
    }
    if (input.combatState?.isActive) {
        const round = input.combatState.round ?? '?';
        const turn = input.combatState.turn ?? '?';
        chunks.push({
            kind: 'active_combat',
            text: `Combate ativo (rodada ${round}, turno ${turn}).`,
            priority: 2,
        });
    }
    if (Array.isArray(input.stateHints) && input.stateHints.length) {
        chunks.push({
            kind: 'last_player_action',
            text: `Deltas recentes: ${input.stateHints.join('; ')}`,
            priority: 2,
        });
    }
    if (input.homebrewSummary?.trim()) {
        chunks.push({ kind: 'distant_lore', text: input.homebrewSummary.trim().slice(0, 800), priority: 8 });
    }

    return trimContextBudget(chunks, maxChars);
}
