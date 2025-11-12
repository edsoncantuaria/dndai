// backend/src/rules/characterSnapshot.ts
import createError from 'http-errors';
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { CharacterAttributes } from '../entities/CharacterAttributes.js';
import { CharacterProficiency } from '../entities/CharacterProficiency.js';
import type { RulesCharacterSnapshot, Ability } from './types.js';
import { computeProficiencyBonus } from './utils.js';

const DEFAULT_ABILITIES: Record<Ability, number> = {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
};

export async function loadCharacterSnapshot(sessionId: number, userId: number): Promise<RulesCharacterSnapshot> {
    const sessaoRepo = AppDataSource.getRepository(SessaoIA);
    const sessao = await sessaoRepo.findOne({
        where: { id: sessionId, userId },
        relations: ['character', 'character.attributes', 'character.proficiencies'],
    });

    if (!sessao) {
        throw createError(404, 'Sessão não encontrada para validação de ação.');
    }
    if (!sessao.character) {
        throw createError(400, 'Sessão não possui personagem ativo para validar ações.');
    }

    const attributes = sessao.character.attributes ?? ({
        ...DEFAULT_ABILITIES,
        characterId: sessao.character.id,
    } as CharacterAttributes);

    const weaponProficiencies =
        sessao.character.proficiencies
            ?.filter(
                (prof: CharacterProficiency) =>
                    prof.type?.toLowerCase().includes('weapon') || prof.index?.toLowerCase().includes('weapon')
            )
            ?.flatMap((prof: CharacterProficiency) => {
                const normalized: string[] = [];
                if (prof.index) normalized.push(prof.index.toLowerCase());
                if (prof.name) normalized.push(prof.name.toLowerCase());
                return normalized;
            }) ?? [];

    const skillProficiencies =
        sessao.character.proficiencies
            ?.filter((prof: CharacterProficiency) => prof.type?.toLowerCase().includes('skill'))
            ?.map((prof: CharacterProficiency) => prof.index?.toLowerCase())
            .filter((value): value is string => Boolean(value)) ?? [];

    const abilityScores: Record<Ability, number> = {
        strength: attributes.strength ?? DEFAULT_ABILITIES.strength,
        dexterity: attributes.dexterity ?? DEFAULT_ABILITIES.dexterity,
        constitution: attributes.constitution ?? DEFAULT_ABILITIES.constitution,
        intelligence: attributes.intelligence ?? DEFAULT_ABILITIES.intelligence,
        wisdom: attributes.wisdom ?? DEFAULT_ABILITIES.wisdom,
        charisma: attributes.charisma ?? DEFAULT_ABILITIES.charisma,
    };

    const level = sessao.character.level ?? 1;

    return {
        id: `character:${sessao.character.id}`,
        name: sessao.character.name,
        level,
        proficiencyBonus: computeProficiencyBonus(level),
        abilities: abilityScores,
        weaponProficiencies,
        skillProficiencies,
    };
}
