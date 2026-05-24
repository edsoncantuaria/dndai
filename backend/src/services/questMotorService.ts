import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { Character } from '../entities/Character.js';
import { awardMotorXpToCharacter } from './motorXpService.js';
import { calculateQuestCompletionXp, clampCharacterLevel } from './xpService.js';
import type { QuestCompletePayload } from '../rules/questMotor.js';
import createError from 'http-errors';

export type QuestXpResult = {
    xpAwarded: number;
    newXp: number;
    computedLevel: number;
};

export async function completeQuestMotor(
    sessionId: number,
    userId: number,
    payload: QuestCompletePayload,
): Promise<QuestXpResult> {
    const sessaoRepo = AppDataSource.getRepository(SessaoIA);
    const sessao = await sessaoRepo.findOne({
        where: { id: sessionId, userId },
        select: ['id', 'characterId'],
    });
    if (!sessao?.characterId) {
        throw createError(404, 'Sessão ou personagem não encontrado.');
    }

    const charRepo = AppDataSource.getRepository(Character);
    const character = await charRepo.findOne({
        where: { id: sessao.characterId },
        select: ['id', 'xp', 'level'],
    });
    if (!character) throw createError(404, 'Personagem não encontrado.');

    const level = clampCharacterLevel(payload.questLevel ?? character.level ?? 1);
    const xpAmount = calculateQuestCompletionXp(level);

    const awarded = await awardMotorXpToCharacter(character.id, [
        {
            type: 'quest',
            questLevel: level,
            difficulty: payload.difficulty,
            description: payload.description ?? 'Objetivo concluído.',
        },
    ]);

    if (!awarded || awarded.applied.totalXpAwarded <= 0) {
        return {
            xpAwarded: xpAmount,
            newXp: character.xp ?? 0,
            computedLevel: clampCharacterLevel(character.level ?? 1),
        };
    }

    return {
        xpAwarded: awarded.applied.totalXpAwarded,
        newXp: awarded.newXp,
        computedLevel: awarded.computedLevel,
    };
}
