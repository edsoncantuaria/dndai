import type { ActionIntent } from '../../rules/actionIntentTypes.js';
import { listNormalizedSkills } from '../../rules/skills.js';
import type { SkillCheckIntentPayload } from '../../rules/types.js';
import {
    playerActionImpliesSkillRoll,
    resolveSkillForPlayerAction,
} from './skillActionSemantics.js';

const DIFFICULTY_HINTS: Array<{ pattern: RegExp; difficulty: SkillCheckIntentPayload['difficulty'] }> =
    [
        { pattern: /\b(fácil|facil|simples)\b/i, difficulty: 'easy' },
        { pattern: /\b(difícil|dificil|árduo|arduo|complexo)\b/i, difficulty: 'hard' },
        { pattern: /\b(quase impossível|impossível)\b/i, difficulty: 'nearly_impossible' },
    ];

/**
 * Heurística PT-BR: detecta teste de perícia em ação livre com validação de contexto D&D 5e.
 */
export async function inferSkillCheckFromFreeText(
    _sessionId: number,
    _userId: number,
    playerAction: string,
): Promise<ActionIntent | null> {
    const text = playerAction.trim();
    if (!playerActionImpliesSkillRoll(text)) return null;

    const skills = await listNormalizedSkills();
    const resolution = resolveSkillForPlayerAction(text, skills);
    if (!resolution) return null;

    let difficulty: SkillCheckIntentPayload['difficulty'] | undefined;
    for (const hint of DIFFICULTY_HINTS) {
        if (hint.pattern.test(text)) {
            difficulty = hint.difficulty;
            break;
        }
    }

    const payload: SkillCheckIntentPayload = {
        skillIndex: resolution.skillIndex,
        difficulty,
        ...(resolution.resolutionNote ? { resolutionNote: resolution.resolutionNote } : {}),
    };

    return { type: 'skill-check', payload };
}
