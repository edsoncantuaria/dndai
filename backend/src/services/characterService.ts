// backend/src/services/characterService.ts
import { AppDataSource } from '../database/data-source.js';
import { Character } from '../entities/Character.js';
import { CharacterAttributes } from '../entities/CharacterAttributes.js';
import { CharacterProficiency } from '../entities/CharacterProficiency.js';
import { CharacterItem } from '../entities/CharacterItem.js';
import { CharacterSpell } from '../entities/CharacterSpell.js';
import { SessaoIA } from '../entities/SessaoIA.js'; // Importar SessaoIA
import { IsNull } from 'typeorm';
import createError from 'http-errors';
import type { z } from 'zod';
import type { NewCharacterInfoSchema } from '../schemas/validationSchemas.js';
import * as DndApiService from './dndApiService.js';
import redisClient from '../database/redis-client.js';

// Função auxiliar para reconstruir o objeto completo do personagem para o frontend
export const buildFullCharacterObject = async (character: Character) => {
    const cacheKey = `character:${character.id}`;

    // 1. Tenta buscar do cache
    if (redisClient && redisClient.isOpen) {
        try {
            const cachedCharacter = await redisClient.get(cacheKey);
            if (cachedCharacter) {
                console.log(`[Cache] HIT: Carregando personagem ${character.id} do cache.`);
                return JSON.parse(cachedCharacter);
            }
            console.log(`[Cache] MISS: Personagem ${character.id} não encontrado no cache.`);
        } catch (error) {
            console.error(`[Cache] Erro ao buscar personagem ${character.id} do Redis:`, error);
        }
    }


    const fullCharacter = await AppDataSource.getRepository(Character).findOne({
        where: { id: character.id },
        relations: [
            "attributes", "proficiencies", "items", "spells",
            "journal", "journal.subLocations",
            "relationships", "relationships.quests",
        ],
    });
    if (!fullCharacter) return character;

    const inventory = fullCharacter.items.map((item: CharacterItem) => ({ 
        ...item.itemData, 
        id: item.id.toString(),
        quantity: item.quantity, 
        equipped: item.equipped 
    }));

    const characterData = {
        ...fullCharacter,
        attributes: fullCharacter.attributes,
        proficiencies: fullCharacter.proficiencies.map(p => ({ index: p.index, name: p.name, type: p.type })),
        inventory: inventory,
        spells: fullCharacter.spells,
        journal: fullCharacter.journal,
        relationships: fullCharacter.relationships,
        feats: fullCharacter.feats || [],
    };
    
    // 2. Salva o resultado no cache antes de retornar
    if (redisClient && redisClient.isOpen) {
        try {
            // Cache por 1 hora para dados de personagem
            await redisClient.set(cacheKey, JSON.stringify(characterData), { EX: 3600 });
             console.log(`[Cache] SET: Personagem ${character.id} salvo no cache.`);
        } catch (error) {
            console.error(`[Cache] Erro ao salvar personagem ${character.id} no Redis:`, error);
        }
    }

    return characterData;
};

export const createCharacter = async (userId: number, characterData: z.infer<typeof NewCharacterInfoSchema>) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const classDetails: any = await DndApiService.getDetails('classes', characterData.characterClass.toLowerCase());
        if (!classDetails) {
            throw createError(404, `A classe '${characterData.characterClass}' não foi encontrada.`);
        }
        
        const itemPromises = characterData.inventory.map(async (itemData: any) => {
            const details = await DndApiService.getEquipmentDetails(itemData.index);
            return { 
                ...details, 
                ...itemData, 
                quantity: itemData.quantity || 1 
            };
        });
        const detailedItems = await Promise.all(itemPromises);
        
        const newCharacter = new Character();
        Object.assign(newCharacter, {
            userId,
            name: characterData.name,
            race: characterData.race,
            subrace: characterData.subrace,
            characterClass: classDetails.name,
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
            feats: characterData.feats || [],
            homebrewContentIds: characterData.homebrewIds || [], // Salva os IDs de homebrew do personagem
        });

        const savedCharacter = await queryRunner.manager.save(newCharacter);

        const attributes = new CharacterAttributes();
        Object.assign(attributes, characterData.attributes);
        const hitDie = classDetails.hit_die || 8;
        attributes.hp = hitDie + Math.floor((characterData.attributes.constitution - 10) / 2);
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

        const items = detailedItems.map(itemData => {
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
    const sessaoRepository = AppDataSource.getRepository(SessaoIA);

    const activeSessions = await sessaoRepository.count({
        where: { characterId, userId, deletedAt: IsNull() }
    });

    if (activeSessions > 0) {
        throw createError(409, 'Este personagem não pode ser excluído pois está vinculado a uma ou mais sessões de jogo. Por favor, exclua as sessões primeiro.');
    }

    const result = await characterRepository.softDelete({ id: characterId, userId });

    if (result.affected === 0) {
        throw createError(404, 'Personagem não encontrado ou você não tem permissão para deletá-lo.');
    }

    // Invalida o cache
    if (redisClient && redisClient.isOpen) {
        await redisClient.del(`character:${characterId}`);
    }
};
