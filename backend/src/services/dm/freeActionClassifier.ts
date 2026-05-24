import type { ActionIntent } from '../../rules/actionIntentService.js';
import { listNormalizedSkills } from '../../rules/skills.js';
import type { SkillCheckIntentPayload } from '../../rules/types.js';

const ACTION_VERBS =
    /\b(tento|tentar|tenta|uso|usar|faço|fazer|rolar|rolagem|teste|testar|investigo|investigar|persuado|persuadir|furtiv|escalar|arromb|decifro|decifrar)\b/i;

const DIFFICULTY_HINTS: Array<{ pattern: RegExp; difficulty: SkillCheckIntentPayload['difficulty'] }> =
    [
        { pattern: /\b(fácil|facil|simples)\b/i, difficulty: 'easy' },
        { pattern: /\b(difícil|dificil|árduo|arduo|complexo)\b/i, difficulty: 'hard' },
        { pattern: /\b(quase impossível|impossível)\b/i, difficulty: 'nearly_impossible' },
    ];

function normalizeSkillName(name: string): string {
    return name
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .trim();
}

/**
 * Heurística PT-BR: detecta menção a perícia em ação livre e monta intent skill-check.
 */
export async function inferSkillCheckFromFreeText(
    _sessionId: number,
    _userId: number,
    playerAction: string,
): Promise<ActionIntent | null> {
    const text = playerAction.trim();
    if (!text || text.length < 4) return null;
    if (!ACTION_VERBS.test(text)) return null;

    const skills = await listNormalizedSkills();
    const normalizedText = normalizeSkillName(text);

    let matched: { index: string; name: string } | null = null;
    for (const skill of skills) {
        const ptName = normalizeSkillName(skill.name);
        if (normalizedText.includes(ptName)) {
            matched = { index: skill.index, name: skill.name };
            break;
        }
    }

    if (!matched) {
        const aliasMap: Record<string, string> = {
            furtividade: 'stealth',
            atletismo: 'athletics',
            persuasao: 'persuasion',
            persuasão: 'persuasion',
            intimidacao: 'intimidation',
            intimidação: 'intimidation',
            percepcao: 'perception',
            percepção: 'perception',
            investigacao: 'investigation',
            investigação: 'investigation',
            arcanismo: 'arcana',
            religiao: 'religion',
            religião: 'religion',
            natureza: 'nature',
            historia: 'history',
            história: 'history',
            acrobacia: 'acrobatics',
            adestrar: 'animal-handling',
            medicina: 'medicine',
            prestidigitacao: 'sleight-of-hand',
            prestidigitação: 'sleight-of-hand',
            sobrevivencia: 'survival',
            sobrevivência: 'survival',
        };
        for (const [alias, index] of Object.entries(aliasMap)) {
            if (normalizedText.includes(alias)) {
                const skill = skills.find(s => s.index === index);
                if (skill) {
                    matched = { index: skill.index, name: skill.name };
                    break;
                }
            }
        }
    }

    if (!matched) return null;

    let difficulty: SkillCheckIntentPayload['difficulty'] | undefined;
    for (const hint of DIFFICULTY_HINTS) {
        if (hint.pattern.test(text)) {
            difficulty = hint.difficulty;
            break;
        }
    }

    const payload: SkillCheckIntentPayload = {
        skillIndex: matched.index,
        difficulty,
    };

    return { type: 'skill-check', payload };
}
