// backend/src/rules/skills.ts
import { getSrdResource, listSrdResources } from '../services/srdCatalogService.js';
import { computeAbilityBonus } from './utils.js';
import type {
    NormalizedSkill,
    SkillCheckIntentPayload,
    RuleCheckResult,
    RulesCharacterSnapshot,
    SkillDifficulty,
} from './types.js';

const skillCache = new Map<string, NormalizedSkill>();

const DIFFICULTY_TO_DC: Record<SkillDifficulty, number> = {
    very_easy: 5,
    easy: 10,
    medium: 15,
    hard: 20,
    very_hard: 25,
    nearly_impossible: 30,
};

export async function listNormalizedSkills(): Promise<NormalizedSkill[]> {
    if (skillCache.size) {
        return Array.from(skillCache.values());
    }
    const skills = await listSrdResources('skills');
    skills.forEach((skill: any) => {
        const normalized = normalizeSkill(skill);
        skillCache.set(normalized.index, normalized);
    });
    return Array.from(skillCache.values());
}

export async function getNormalizedSkill(index: string): Promise<NormalizedSkill | null> {
    if (skillCache.has(index)) return skillCache.get(index)!;
    const data = await getSrdResource('skills', index);
    if (!data) return null;
    const normalized = normalizeSkill(data);
    skillCache.set(index, normalized);
    return normalized;
}

function normalizeSkill(skill: any): NormalizedSkill {
    return {
        index: skill.index,
        name: skill.name,
        ability: skill.ability_score?.index ?? 'ability',
        description: skill.desc ?? [],
    };
}

export async function validateSkillCheck(
    character: RulesCharacterSnapshot,
    payload: SkillCheckIntentPayload
): Promise<RuleCheckResult> {
    const skill = await getNormalizedSkill(payload.skillIndex);
    if (!skill) {
        throw new Error(`Perícia ${payload.skillIndex} não encontrada no SRD.`);
    }
    const ability = payload.ability ?? (skill.ability as any);
    const proficient =
        typeof payload.proficiency === 'boolean'
            ? payload.proficiency
            : character.skillProficiencies?.includes(skill.index) ?? false;

    const { total, breakdown } = computeAbilityBonus({
        character,
        ability,
        proficiency: proficient,
    });

    const rollFormula = total >= 0 ? `1d20+${total}` : `1d20${total}`;
    const inferredDc =
        payload.dc ??
        (payload.difficulty ? DIFFICULTY_TO_DC[payload.difficulty] : undefined);

    return {
        status: 'needs_roll',
        rollRequest: {
            formula: rollFormula,
            modifierBreakdown: [...breakdown, `Perícia: ${skill.name}`],
            context: `Teste de ${skill.name}`,
            targetDc: inferredDc,
            metadata: {
                source: {
                    kind: 'skill',
                    index: skill.index,
                    name: skill.name,
                },
                targets: inferredDc
                    ? [
                          {
                              kind: 'entity',
                              name: 'Desafio informado',
                              armorClass: inferredDc,
                          },
                      ]
                    : undefined,
            },
        },
        data: {
            skill: skill.name,
            ability,
            proficient,
            suggestedDc: inferredDc,
            difficulty: payload.difficulty,
        },
    };
}
