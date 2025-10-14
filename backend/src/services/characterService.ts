// backend/src/services/characterService.ts
import { AppDataSource } from '../database/data-source.js';
import { Character } from '../entities/Character.js';
import { CharacterAttributes } from '../entities/CharacterAttributes.js';
import { CharacterProficiency } from '../entities/CharacterProficiency.js';
import { CharacterItem } from '../entities/CharacterItem.js';
import { CharacterSpell } from '../entities/CharacterSpell.js';
import { IsNull } from 'typeorm';
import createError from 'http-errors';
import type { z } from 'zod';
import type { NewCharacterInfoSchema } from '../schemas/validationSchemas.js';

// Função auxiliar para reconstruir o objeto completo do personagem para o frontend
export const buildFullCharacterObject = async (character: Character) => {
    const fullCharacter = await AppDataSource.getRepository(Character).findOne({
        where: { id: character.id },
        relations: [
            "attributes", "proficiencies", "items", "spells",
            "journal", "relationships", "relationships.quests",
        ],
    });
    if (!fullCharacter) return character;

    const characterData = {
        ...fullCharacter,
        attributes: fullCharacter.attributes,
        proficiencies: fullCharacter.proficiencies.map(p => ({ index: p.index, name: p.name, type: p.type })),
        // CORREÇÃO: Mapeia `items` para `inventory` e garante que `itemData` seja preservado.
        inventory: fullCharacter.items.map((item: CharacterItem) => ({ ...item.itemData, id: item.id.toString(), quantity: item.quantity, equipped: item.equipped })),
        spells: fullCharacter.spells, // Mantém a estrutura de `CharacterSpell`
        journal: fullCharacter.journal,
        relationships: fullCharacter.relationships,
    };
    
    // Remove as propriedades de relação para evitar redundância no objeto final
    delete (characterData as any).items;
    
    return characterData;
};

export const createCharacter = async (userId: number, characterData: z.infer<typeof NewCharacterInfoSchema>) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const newCharacter = new Character();
        Object.assign(newCharacter, {
            userId,
            name: characterData.name,
            race: characterData.race,
            subrace: characterData.subrace,
            characterClass: characterData.characterClass,
            subclassFlavor: characterData.subclassFlavor,
            level: characterData.level,
            background: characterData.background,
            alignment: characterData.alignment,
            backstory: characterData.backstory,
            ideal: characterData.ideal,
            bond: characterData.bond,
            flaw: characterData.flaw,
            sex: characterData.sex,
            hairStyle: characterData.hairStyle,
            beardStyle: characterData.beardStyle,
            skinColor: characterData.skinColor,
        });

        const savedCharacter = await queryRunner.manager.save(newCharacter);

        const attributes = new CharacterAttributes();
        Object.assign(attributes, characterData.attributes);
        attributes.hp = characterData.hitDie + Math.floor((characterData.attributes.constitution - 10) / 2);
        attributes.maxHp = attributes.hp;
        attributes.character = savedCharacter;
        await queryRunner.manager.save(attributes);

        const proficiencies = characterData.proficiencies.map(p => {
            const prof = new CharacterProficiency();
            prof.character = savedCharacter;
            prof.name = p.name;
            prof.index = p.index;
            prof.type = p.url?.includes('skill') ? 'skill' : (p.url?.includes('language') ? 'language' : 'other');
            return prof;
        });
        await queryRunner.manager.save(proficiencies);

        const items = characterData.inventory.map(itemData => {
            const charItem = new CharacterItem();
            charItem.character = savedCharacter;
            charItem.name = itemData.name;
            charItem.quantity = itemData.quantity;
            charItem.itemData = itemData;
            charItem.equipped = itemData.equipped || false;
            return charItem;
        });
        await queryRunner.manager.save(items);

        const spells = characterData.spells.map(spellName => {
            const charSpell = new CharacterSpell();
            charSpell.character = savedCharacter;
            charSpell.spellName = spellName;
            return charSpell;
        });
        await queryRunner.manager.save(spells);

        await queryRunner.commitTransaction();
        return savedCharacter;

    } catch (error) {
        await queryRunner.rollbackTransaction();
        console.error("Error creating character:", error);
        throw createError(500, 'Falha ao criar personagem no banco de dados.');
    } finally {
        await queryRunner.release();
    }
};

export const getCharactersForUser = async (userId: number) => {
    const characterRepository = AppDataSource.getRepository(Character);
    return characterRepository.find({
        where: { userId, deletedAt: IsNull() },
        select: ["id", "name", "race", "characterClass", "level", "createdAt"]
    });
};

export const getCharacterById = async (characterId: number, userId: number) => {
    const characterRepository = AppDataSource.getRepository(Character);
    const character = await characterRepository.findOne({
        where: { id: characterId, userId, deletedAt: IsNull() },
    });

    if (!character) {
        throw createError(404, 'Personagem não encontrado ou você não tem permissão.');
    }

    return buildFullCharacterObject(character);
};

export const deleteCharacter = async (characterId: number, userId: number) => {
    const characterRepository = AppDataSource.getRepository(Character);
    const result = await characterRepository.softDelete({ id: characterId, userId });

    if (result.affected === 0) {
        throw createError(404, 'Personagem não encontrado ou você não tem permissão para deletá-lo.');
    }
};