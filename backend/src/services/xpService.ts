// backend/src/services/xpService.ts
import type { Character } from '../entities/Character.js';

const SKILL_XP_TABLE = [
    { min: 1, max: 5, xp: 10, label: 'Very Easy' },
    { min: 6, max: 9, xp: 25, label: 'Easy' },
    { min: 10, max: 15, xp: 50, label: 'Medium' },
    { min: 16, max: 20, xp: 75, label: 'Hard' },
    { min: 21, max: 29, xp: 100, label: 'Very Hard' },
    { min: 30, max: Infinity, xp: 200, label: 'Extreme' },
] as const;

const QUEST_XP_TABLE: Record<number, number> = {
    1: 100, 2: 100,
    3: 150,
    4: 200,
    5: 250,
    6: 300,
    7: 350,
    8: 400,
    9: 450,
    10: 500,
    11: 550,
    12: 600,
    13: 650,
    14: 700,
    15: 750,
    16: 800,
    17: 850,
    18: 900,
    19: 950,
    20: 1000,
};

const clampLevel = (level: number): number => {
    if (!Number.isFinite(level)) return 1;
    return Math.max(1, Math.min(20, Math.round(level)));
};

export type XpEventType = 'skill' | 'quest';

export interface XpEventPayload {
    type: XpEventType;
    dc?: number;
    difficulty?: 'very_easy' | 'easy' | 'medium' | 'hard' | 'very_hard' | 'extreme';
    questLevel?: number;
    description?: string;
}

export interface AppliedXpResult {
    totalXpAwarded: number;
    summaries: string[];
}

const normaliseDifficultyLabel = (value?: string): (typeof SKILL_XP_TABLE)[number] | null => {
    if (!value) return null;
    const normalized = value.toLowerCase();
    switch (normalized) {
        case 'very easy':
        case 'very_easy':
            return SKILL_XP_TABLE[0];
        case 'easy':
            return SKILL_XP_TABLE[1];
        case 'medium':
            return SKILL_XP_TABLE[2];
        case 'hard':
            return SKILL_XP_TABLE[3];
        case 'very hard':
        case 'very_hard':
            return SKILL_XP_TABLE[4];
        case 'extreme':
            return SKILL_XP_TABLE[5];
        default:
            return null;
    }
};

export const calculateSkillCheckXp = (dc?: number, difficulty?: string): number => {
    if (typeof dc === 'number' && Number.isFinite(dc)) {
        const tableEntry = SKILL_XP_TABLE.find(entry => dc >= entry.min && dc <= entry.max);
        if (tableEntry) return tableEntry.xp;
    }

    const difficultyEntry = normaliseDifficultyLabel(difficulty);
    if (difficultyEntry) return difficultyEntry.xp;

    return 0;
};

export const calculateQuestCompletionXp = (level: number): number => {
    const clamped = clampLevel(level);
    return QUEST_XP_TABLE[clamped] ?? 0;
};

export const applyXpEvents = (
    character: Pick<Character, 'xp' | 'level'>,
    events: XpEventPayload[] | undefined | null
): AppliedXpResult => {
    if (!Array.isArray(events) || events.length === 0) {
        return { totalXpAwarded: 0, summaries: [] };
    }

    let total = 0;
    const summaries: string[] = [];

    for (const event of events) {
        if (!event || typeof event !== 'object') continue;

        if (event.type === 'skill') {
            const xp = calculateSkillCheckXp(event.dc, event.difficulty);
            if (xp > 0) {
                total += xp;
                const dcInfo = event.dc ? `DC ${event.dc}` : event.difficulty ? `dificuldade ${event.difficulty}` : 'dificuldade estimada';
                summaries.push(`+${xp} XP por sucesso em teste de perícia (${dcInfo})${event.description ? `: ${event.description}` : ''}.`);
            }
        } else if (event.type === 'quest') {
            const questLevel = event.questLevel ?? character.level;
            const xp = calculateQuestCompletionXp(questLevel);
            if (xp > 0) {
                total += xp;
                summaries.push(`+${xp} XP por concluir missão de nível ${questLevel}${event.description ? `: ${event.description}` : ''}.`);
            }
        }
    }

    return { totalXpAwarded: total, summaries };
};
