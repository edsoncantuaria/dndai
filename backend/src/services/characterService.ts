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
import { getResourceDetails } from './dndApiService.js';
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
        const classDetails: any = await getResourceDetails('classes', characterData.characterClass.toLowerCase());
        if (!classDetails) {
            throw createError(404, `A classe '${characterData.characterClass}' não foi encontrada.`);
        }
        
        const itemPromises = (characterData.inventory || []).map(async (itemData: any) => {
             if (!itemData || !itemData.index) return null;
            const details = await getResourceDetails('equipment', itemData.index);
            return { 
                ...details, 
                ...itemData, 
                quantity: itemData.quantity || 1 
            };
        });
        const detailedItems = (await Promise.all(itemPromises)).filter(Boolean);
        
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
            homebrewContentIds: characterData.homebrewIds || [],
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

export const cloneCharacter = async (
  originalCharacterId: number,
  userId: number,
  newName?: string
): Promise<Character> => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const characterRepo = queryRunner.manager.getRepository(Character);
    const attrRepo = queryRunner.manager.getRepository(CharacterAttributes);
    const profRepo = queryRunner.manager.getRepository(CharacterProficiency);
    const itemRepo = queryRunner.manager.getRepository(CharacterItem);
    const spellRepo = queryRunner.manager.getRepository(CharacterSpell);

    const original = await characterRepo.findOne({
      where: { id: originalCharacterId, userId },
      relations: ["attributes", "items", "proficiencies", "spells"],
    });

    if (!original) {
      throw createError(404, "Personagem original não encontrado para clonagem.");
    }

    // 🔹 Passo 1: cria o novo personagem sem copiar objetos anexados (evita cache de relação antiga)
    const clonedCharacter = characterRepo.create({
      userId,
      name: newName || `${original.name} (Clone)`,
      race: original.race,
      subrace: original.subrace,
      characterClass: original.characterClass,
      subclassFlavor: original.subclassFlavor,
      level: original.level,
      background: original.background,
      alignment: original.alignment,
      backstory: original.backstory,
      ideal: original.ideal,
      bond: original.bond,
      flaw: original.flaw,
      sex: original.sex,
      hairStyle: original.hairStyle,
      beardStyle: original.beardStyle,
      skinColor: original.skinColor,
      feats: original.feats || [],
      homebrewContentIds: original.homebrewContentIds || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const savedClone = await characterRepo.save(clonedCharacter);

    // 🔹 Passo 2: clonar atributos (garantindo que o antigo relacionamento não seja reutilizado)
    if (original.attributes) {
      const { id, characterId, ...safeAttributes } = original.attributes;

      // verifica se há algo preso ao characterId (raro, mas seguro)
      const existing = await attrRepo.findOne({ where: { characterId: savedClone.id } });
      if (existing) await attrRepo.delete({ characterId: savedClone.id });

      const clonedAttributes = attrRepo.create({
        ...safeAttributes,
        characterId: savedClone.id,
      });
      await attrRepo.save(clonedAttributes);
    }

    // 🔹 Passo 3: clonar proficiências
    if (original.proficiencies?.length) {
      const newProfs = original.proficiencies.map(({ id, characterId, ...safe }) =>
        profRepo.create({ ...safe, characterId: savedClone.id })
      );
      await profRepo.save(newProfs);
    }

    // 🔹 Passo 4: clonar itens
    if (original.items?.length) {
      const newItems = original.items.map(({ id, characterId, ...safe }) =>
        itemRepo.create({ ...safe, characterId: savedClone.id })
      );
      await itemRepo.save(newItems);
    }

    // 🔹 Passo 5: clonar magias
    if (original.spells?.length) {
      const newSpells = original.spells.map(({ id, characterId, ...safe }) =>
        spellRepo.create({ ...safe, characterId: savedClone.id })
      );
      await spellRepo.save(newSpells);
    }

    await queryRunner.commitTransaction();
    return savedClone;
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error("Erro ao clonar personagem:", error);
    throw createError(500, "Falha ao clonar o personagem para a nova sessão.");
  } finally {
    await queryRunner.release();
  }
};


export const getCharactersForUser = async (userId: number) => {
    const characterRepository = AppDataSource.getRepository(Character);
    // Adiciona a condição para buscar apenas personagens que NÃO estão em uma sessão.
    // Isso os torna "modelos" reutilizáveis.
    const characters = await characterRepository
        .createQueryBuilder('character')
        .leftJoin('character.sessoes', 'sessao')
        .where('character.userId = :userId', { userId })
        .andWhere('character.deletedAt IS NULL')
        .andWhere('sessao.id IS NULL') // A condição chave!
        .select(['character.id', 'character.name', 'character.race', 'character.characterClass', 'character.level', 'character.createdAt'])
        .getMany();

    return characters;
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
        throw createError(409, 'Este personagem não pode ser excluído pois está vinculado a uma ou mais sessões de jogo ativas. Por favor, exclua as sessões primeiro.');
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
