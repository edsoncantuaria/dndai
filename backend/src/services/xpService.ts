// backend/src/services/xpService.ts
import type { Character } from '../entities/Character.js';

const SKILL_XP_TABLE = [
    { min: 1, max: 5, xp: 1, label: 'Very Easy' },
    { min: 6, max: 9, xp: 2, label: 'Easy' },
    { min: 10, max: 15, xp: 4, label: 'Medium' },
    { min: 16, max: 20, xp: 6, label: 'Hard' },
    { min: 21, max: 29, xp: 7, label: 'Very Hard' },
    { min: 30, max: Infinity, xp: 8, label: 'Extreme' },
] as const;

const COMBAT_XP_TABLE = [
    { min: 1, max: 5, xp: 30, label: 'Very Easy' },
    { min: 6, max: 9, xp: 40, label: 'Easy' },
    { min: 10, max: 15, xp: 50, label: 'Medium' },
    { min: 16, max: 20, xp: 60, label: 'Hard' },
    { min: 21, max: 29, xp: 70, label: 'Very Hard' },
    { min: 30, max: Infinity, xp: 75, label: 'Extreme' },
] as const;

const QUEST_LEVEL_FALLBACK_TABLE: Record<number, number> = {
    1: 30, 2: 30,
    3: 40, 4: 40,
    5: 50, 6: 50,
    7: 60, 8: 60,
    9: 70, 10: 70,
    11: 72, 12: 72,
    13: 73, 14: 73,
    15: 74, 16: 74,
    17: 75, 18: 75,
    19: 75, 20: 75,
};

const clampLevel = (level: number): number => {
    if (!Number.isFinite(level)) return 1;
    return Math.max(1, Math.min(20, Math.round(level)));
};

export type XpEventType = 'skill' | 'quest' | 'combat';

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
    details: AppliedXpDetail[];
}

export interface AppliedXpDetail {
    type: XpEventType;
    xp: number;
    source: string;
    label: string;
    description?: string;
}

const findTableEntryByDifficulty = <T extends { label: string }>(
    value: string | undefined,
    table: readonly T[]
): T | null => {
    if (!value) return null;
    const normalized = value.toLowerCase();
    switch (normalized) {
        case 'very easy':
        case 'very_easy':
            return table[0];
        case 'easy':
            return table[1];
        case 'medium':
            return table[2];
        case 'hard':
            return table[3];
        case 'very hard':
        case 'very_hard':
            return table[4];
        case 'extreme':
            return table[5];
        default:
            return null;
    }
};

export const calculateSkillCheckXp = (dc?: number, difficulty?: string): number => {
    if (typeof dc === 'number' && Number.isFinite(dc)) {
        const tableEntry = SKILL_XP_TABLE.find(entry => dc >= entry.min && dc <= entry.max);
        if (tableEntry) return tableEntry.xp;
    }

    const difficultyEntry = findTableEntryByDifficulty(difficulty, SKILL_XP_TABLE);
    if (difficultyEntry) return difficultyEntry.xp;

    return 0;
};

export const calculateCombatXp = (dc?: number, difficulty?: string): number => {
    if (typeof dc === 'number' && Number.isFinite(dc)) {
        const tableEntry = COMBAT_XP_TABLE.find(entry => dc >= entry.min && dc <= entry.max);
        if (tableEntry) return tableEntry.xp;
    }
    const difficultyEntry = findTableEntryByDifficulty(difficulty, COMBAT_XP_TABLE);
    return difficultyEntry ? difficultyEntry.xp : 0;
};

export const calculateQuestCompletionXp = (level: number): number => {
    const clamped = clampLevel(level);
    return QUEST_LEVEL_FALLBACK_TABLE[clamped] ?? 0;
};

export const applyXpEvents = (
    character: Pick<Character, 'xp' | 'level'>,
    events: XpEventPayload[] | undefined | null
): AppliedXpResult => {
    if (!Array.isArray(events) || events.length === 0) {
        return { totalXpAwarded: 0, summaries: [], details: [] };
    }

    let total = 0;
    const summaries: string[] = [];
    const details: AppliedXpDetail[] = [];

    for (const event of events) {
        if (!event || typeof event !== 'object') continue;

        if (event.type === 'skill') {
            const xp = calculateSkillCheckXp(event.dc, event.difficulty);
            if (xp > 0) {
                total += xp;
                const dcInfo = event.dc ? `DC ${event.dc}` : event.difficulty ? `dificuldade ${event.difficulty}` : 'dificuldade estimada';
                const description = event.description ? event.description.trim() : '';
                summaries.push(`+${xp} XP por sucesso em teste de perícia (${dcInfo})${description ? `: ${description}` : ''}.`);

                const difficultyLabel = (() => {
                    if (event.dc) return `Perícia (DC ${event.dc})`;
                    const tableEntry = normaliseDifficultyLabel(event.difficulty);
                    return tableEntry ? `Perícia (${tableEntry.label})` : 'Perícia';
                })();

                details.push({
                    type: 'skill',
                    xp,
                    source: difficultyLabel,
                    label: description || 'Sucesso em perícia',
                    description: description || undefined,
                });
            }
        } else if (event.type === 'combat') {
            const xp = calculateCombatXp(event.dc, event.difficulty);
            if (xp > 0) {
                total += xp;
                const dcInfo = event.dc ? `DC ${event.dc}` : event.difficulty ? `dificuldade ${event.difficulty}` : 'dificuldade estimada';
                const description = event.description ? event.description.trim() : '';
                summaries.push(`+${xp} XP por vitória em combate (${dcInfo})${description ? `: ${description}` : ''}.`);

                const difficultyLabel = (() => {
                    if (event.dc) return `Combate (DC ${event.dc})`;
                    const tableEntry = findTableEntryByDifficulty(event.difficulty, COMBAT_XP_TABLE);
                    return tableEntry ? `Combate (${tableEntry.label})` : 'Combate';
                })();

                details.push({
                    type: 'combat',
                    xp,
                    source: difficultyLabel,
                    label: description || 'Vitória em combate',
                    description: description || undefined,
                });
            }
        } else if (event.type === 'quest') {
            const questLevel = event.questLevel ?? character.level;
            const difficultyXp = calculateCombatXp(event.dc, event.difficulty);
            const xp = difficultyXp || calculateQuestCompletionXp(questLevel);
            if (xp > 0) {
                total += xp;
                const description = event.description ? event.description.trim() : '';
                const detailInfo = difficultyXp
                    ? (event.dc ? `DC ${event.dc}` : event.difficulty ? `dificuldade ${event.difficulty}` : `nível ${questLevel}`)
                    : `nível ${questLevel}`;
                summaries.push(`+${xp} XP por concluir missão (${detailInfo})${description ? `: ${description}` : ''}.`);
                const source = difficultyXp
                    ? `Missão (${detailInfo})`
                    : `Missão nível ${questLevel}`;
                details.push({
                    type: 'quest',
                    xp,
                    source,
                    label: description || 'Objetivo cumprido',
                    description: description || undefined,
                });
            }
        }
    }

    return { totalXpAwarded: total, summaries, details };
};
