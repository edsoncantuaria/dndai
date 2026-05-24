import { AppDataSource } from '../database/data-source.js';
import { Character } from '../entities/Character.js';
import {
    applyXpEvents,
    clampCharacterLevel,
    type AppliedXpResult,
    type XpEventPayload,
} from './xpService.js';
import { levelFromTotalXp } from './progressionMotorService.js';

export type MotorXpAwardResult = {
    applied: AppliedXpResult;
    previousXp: number;
    newXp: number;
    previousLevel: number;
    computedLevel: number;
    persisted: boolean;
};

/** Concede XP no banco — a IA não altera XP em narration_only. */
export async function awardMotorXpToCharacter(
    characterId: number,
    events: XpEventPayload[],
): Promise<MotorXpAwardResult | null> {
    if (!events.length) return null;

    const repo = AppDataSource.getRepository(Character);
    const character = await repo.findOne({
        where: { id: characterId },
        select: ['id', 'xp', 'level'],
    });
    if (!character) return null;

    const previousXp = Math.max(0, Number(character.xp) || 0);
    const previousLevel = clampCharacterLevel(character.level ?? 1);

    const applied = applyXpEvents(
        { xp: previousXp, level: previousLevel },
        events,
    );
    if (applied.totalXpAwarded <= 0) return null;

    const newXp = previousXp + applied.totalXpAwarded;
    await repo.update({ id: characterId }, { xp: newXp });

    const computedLevel = clampCharacterLevel(levelFromTotalXp(newXp));

    return {
        applied,
        previousXp,
        newXp,
        previousLevel,
        computedLevel,
        persisted: true,
    };
}
