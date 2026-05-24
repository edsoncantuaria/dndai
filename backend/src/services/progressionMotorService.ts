import { v4 as uuidv4 } from 'uuid';
import type { GameMasterResponse } from '../schemas/gameSchemas.js';
import type { LevelUpState } from '../types.js';
import { clampCharacterLevel } from './xpService.js';

/** Limiares de XP D&D 5e (nível 1–20). */
const XP_BY_LEVEL = [
    0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000,
    165000, 195000, 225000, 265000, 305000, 355000,
];

export function levelFromTotalXp(xp: number): number {
    const safe = Math.max(0, Math.floor(Number(xp) || 0));
    for (let i = XP_BY_LEVEL.length - 1; i >= 0; i -= 1) {
        if (safe >= XP_BY_LEVEL[i]) return i + 1;
    }
    return 1;
}

export function buildMinimalLevelUpState(newLevel: number): LevelUpState {
    return {
        isPending: true,
        newLevel: clampCharacterLevel(newLevel),
        choices: {
            asi: { count: 0 },
            spellsToChoose: 0,
        },
    };
}

/**
 * Anexa level-up e feed de progressão com base no XP real do personagem (motor).
 * A IA não decide nível — apenas narra depois que o jogador confirma na UI.
 */
export function attachMotorProgressionToResponse(
    response: GameMasterResponse,
    snapshot: { level?: number; xp?: number },
): { leveledUp: boolean; newLevel: number | null } {
    const prevLevel = clampCharacterLevel(snapshot.level ?? 1);
    const xp = Math.max(0, Number(snapshot.xp) || 0);
    const computedLevel = clampCharacterLevel(levelFromTotalXp(xp));

    if (computedLevel <= prevLevel) {
        return { leveledUp: false, newLevel: null };
    }

    response.levelUpState = buildMinimalLevelUpState(computedLevel);
    const feed = Array.isArray((response as any).progressionFeed)
        ? [...(response as any).progressionFeed]
        : [];
    feed.push({
        type: 'level_up',
        level: computedLevel,
        summary: `Nível ${computedLevel} alcançado! Confirme na ficha.`,
    });
    (response as any).progressionFeed = feed;

    response.logEntries = [
        ...(response.logEntries ?? []),
        {
            id: uuidv4(),
            type: 'system',
            content: `Você atingiu o nível ${computedLevel}! Abra a tela de progressão para escolher HP e opções.`,
        },
    ];

    return { leveledUp: true, newLevel: computedLevel };
}
