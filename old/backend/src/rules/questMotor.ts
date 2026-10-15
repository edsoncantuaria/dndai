import type { RuleCheckResult } from './types.js';
import type { CombatState } from '../schemas/gameSchemas.js';

export type QuestCompletePayload = {
    questLevel?: number;
    difficulty?: 'easy' | 'medium' | 'hard' | 'very_easy' | 'very_hard' | 'extreme';
    description?: string;
};

export function validateQuestCompleteIntent(
    combatState: CombatState | null | undefined,
    payload: QuestCompletePayload,
): RuleCheckResult {
    if (combatState?.isActive) {
        return { status: 'rejected', reason: 'Não é possível concluir missão durante combate ativo.' };
    }
    const level = Number(payload.questLevel);
    if (payload.questLevel !== undefined && (!Number.isFinite(level) || level < 1 || level > 20)) {
        return { status: 'rejected', reason: 'questLevel deve estar entre 1 e 20.' };
    }
    return {
        status: 'accepted',
        authoritativeSignature: 'quest-complete',
        data: payload as Record<string, unknown>,
    };
}
