// backend/src/services/characterService.ts
import { AppDataSource } from '../database/data-source.js';
import { Character } from '../entities/Character.js';
import { CharacterAttributes } from '../entities/CharacterAttributes.js';
import { CharacterProficiency } from '../entities/CharacterProficiency.js';
import { CharacterItem } from '../entities/CharacterItem.js';
import { CharacterSpell } from '../entities/CharacterSpell.js';
import { SessaoIA } from '../entities/SessaoIA.js'; // Importar SessaoIA
import { IsNull, QueryRunner } from 'typeorm';
import createError from 'http-errors';
import type { z } from 'zod';
import type { NewCharacterInfoSchema } from '../schemas/validationSchemas.js';
import { getResourceDetails } from './dndApiService.js';
import redisClient from '../database/redis-client.js';
import { env } from '../config/env.js';
import { JournalEntry } from '../entities/JournalEntry.js';
import { Relationship } from '../entities/Relationship.js';
import { Quest } from '../entities/Quest.js';
import { syncQuestKeywords, extractQuestKeywordStrings } from './questKeywordService.js';
import { v4 as uuidv4 } from 'uuid';


const createAttributesFallback = (characterId: number): CharacterAttributes => {
    const attrs = new CharacterAttributes();
    attrs.id = 0;
    attrs.characterId = characterId;
    attrs.strength = 10;
    attrs.dexterity = 10;
    attrs.constitution = 10;
    attrs.intelligence = 10;
    attrs.wisdom = 10;
    attrs.charisma = 10;
    attrs.hp = 10;
    attrs.maxHp = 10;
    attrs.ac = 10;
    attrs.conditions = [];
    return attrs;
};

// Função auxiliar para reconstruir o objeto completo do personagem para o frontend
interface BuildCharacterOptions {
    disableCache?: boolean;
}

export const buildFullCharacterObject = async (character: Character, options: BuildCharacterOptions = {}) => {
    const cacheKey = `character:${character.id}`;
    const cacheAllowed = env.CHARACTER_CACHE_ENABLED && redisClient && redisClient.isOpen;
    const useCache = cacheAllowed && !options.disableCache;

    // 1. Tenta buscar do cache
    if (useCache) {
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


    const characterRepo = AppDataSource.getRepository(Character);
    const fullCharacter = await characterRepo
        .createQueryBuilder('character')
        .select([
            'character',
            'attributes',
            'proficiencies',
            'items',
            'spells',
            'journal',
            'journalSubLocations',
            'relationships',
            'relationshipQuests',
        ])
        .addSelect('character.id', 'Character_id')
        .leftJoinAndSelect('character.attributes', 'attributes')
        .leftJoinAndSelect('character.proficiencies', 'proficiencies')
        .leftJoinAndSelect('character.items', 'items')
        .leftJoinAndSelect('character.spells', 'spells')
        .leftJoinAndSelect('character.journal', 'journal')
        .leftJoinAndSelect('journal.subLocations', 'journalSubLocations')
        .leftJoinAndSelect('character.relationships', 'relationships')
        .leftJoinAndSelect('relationships.quests', 'relationshipQuests')
        .leftJoinAndSelect('relationshipQuests.keywords', 'questKeywords')
        .where('character.id = :id', { id: character.id })
        .getOne();
    if (!fullCharacter) return character;

    if (!fullCharacter.attributes) {
        const attrRepo = AppDataSource.getRepository(CharacterAttributes);
        const storedAttributes = await attrRepo.findOne({ where: { characterId: character.id } });
        fullCharacter.attributes = storedAttributes ?? createAttributesFallback(character.id);
    } else if (!Array.isArray(fullCharacter.attributes.conditions)) {
        fullCharacter.attributes.conditions = [];
    }

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
    if (useCache) {
        try {
            // Cache por 1 hora para dados de personagem
            await redisClient.set(cacheKey, JSON.stringify(characterData), { EX: 3600 });
             console.log(`[Cache] SET: Personagem ${character.id} salvo no cache.`);
        } catch (error) {
            console.error(`[Cache] Erro ao salvar personagem ${character.id} no Redis:`, error);
        }
    }

    console.log('[buildFullCharacterObject] carregado', {
        characterId: character.id,
        attributes: characterData.attributes,
        inventoryCount: characterData.inventory.length,
    });

    return characterData;
};

export const createCharacter = async (userId: number, characterData: z.infer<typeof NewCharacterInfoSchema>) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const classIndex = (characterData.classIndex || characterData.characterClass || '').trim();
        let classDetails: any = {};
        if (classIndex) {
            classDetails = await getResourceDetails('classes', classIndex.toLowerCase());
            if (!classDetails || Object.keys(classDetails).length === 0) {
                classDetails = await getResourceDetails('classes', classIndex);
            }
        }

        const hasOfficialClassData = classDetails && Object.keys(classDetails).length > 0 && classDetails.name;
        const isHomebrewClass = (characterData.homebrewIds || []).includes(classIndex);

        if (!hasOfficialClassData && !isHomebrewClass) {
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
            characterClass: hasOfficialClassData ? classDetails.name : characterData.characterClass,
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
            isTemplate: true,
            sessionId: null,
        });

        const savedCharacter = await queryRunner.manager.save(newCharacter);

        const attributes = new CharacterAttributes();
        Object.assign(attributes, characterData.attributes);
        const hitDie = typeof classDetails?.hit_die === 'number' ? classDetails.hit_die : (characterData.hitDie || 8);
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

const cloneJournalEntries = async (
    queryRunner: QueryRunner,
    originalEntries: JournalEntry[],
    newCharacterId: number,
    parent: JournalEntry | null = null
): Promise<void> => {
    for (const entry of originalEntries) {
        const { id, character, subLocations, parentLocation, ...entryData } = entry;
        const newEntry = queryRunner.manager.create(JournalEntry, {
            ...entryData,
            id: uuidv4(),
            characterId: newCharacterId,
            parentLocation: parent,
        });
        const savedEntry = await queryRunner.manager.save(newEntry);
        if (entry.subLocations && entry.subLocations.length > 0) {
            await cloneJournalEntries(queryRunner, entry.subLocations, newCharacterId, savedEntry);
        }
    }
};

export const cloneCharacter = async (
  originalCharacterId: number,
  userId: number,
  qr?: QueryRunner,
): Promise<Character> => {
  const queryRunner = qr || AppDataSource.createQueryRunner();
  if (!qr) {
    await queryRunner.connect();
    await queryRunner.startTransaction();
  }

  try {
    const characterRepo = queryRunner.manager.getRepository(Character);

    const original = await characterRepo
      .createQueryBuilder('character')
      .select([
        'character',
        'attributes',
        'items',
        'proficiencies',
        'spells',
        'journal',
        'journalSubLocations',
        'relationships',
        'relationshipQuests',
      ])
      .addSelect('character.id', 'Character_id')
      .leftJoinAndSelect('character.attributes', 'attributes')
      .leftJoinAndSelect('character.items', 'items')
      .leftJoinAndSelect('character.proficiencies', 'proficiencies')
      .leftJoinAndSelect('character.spells', 'spells')
      .leftJoinAndSelect('character.journal', 'journal')
      .leftJoinAndSelect('journal.subLocations', 'journalSubLocations')
      .leftJoinAndSelect('character.relationships', 'relationships')
      .leftJoinAndSelect('relationships.quests', 'relationshipQuests')
      .leftJoinAndSelect('relationshipQuests.keywords', 'questKeywords')
      .where('character.id = :originalCharacterId', { originalCharacterId })
      .andWhere('character.userId = :userId', { userId })
      .getOne();

    if (!original) {
      throw createError(404, "Personagem original não encontrado para clonagem.");
    }

    const {
      id: originalId,
      createdAt,
      updatedAt,
      deletedAt,
      sessoes,
      user,
      attributes,
      proficiencies,
      items,
      spells,
      journal,
      relationships,
      ...restOfCharacter
    } = original;
    
    const clonedCharacter = characterRepo.create({
      ...restOfCharacter,
      userId,
      name: original.name,
      isTemplate: false,
    });

    const savedClone = await characterRepo.save(clonedCharacter);
    console.log('[cloneCharacter] Clonando personagem', {
        originalCharacterId,
        newCharacterId: savedClone.id,
        hasAttributes: !!original.attributes,
        items: original.items?.length ?? 0,
        proficiencies: original.proficiencies?.length ?? 0,
    });

    // Clonar relações
    if (original.attributes) {
        const { id, character, characterId: _oldCharacterId, ...attrs } = original.attributes;
        const newAttrs = queryRunner.manager.create(CharacterAttributes, { ...attrs });
        newAttrs.characterId = savedClone.id;
        newAttrs.character = savedClone;
        await queryRunner.manager.save(newAttrs);
    }
    if (original.proficiencies?.length) {
        const newProfs = original.proficiencies.map(({ id, character, characterId: _oldCharacterId, ...prof }) => {
            const entity = queryRunner.manager.create(CharacterProficiency, { ...prof });
            entity.characterId = savedClone.id;
            entity.character = savedClone;
            return entity;
        });
        await queryRunner.manager.save(newProfs);
    }
    if (original.items?.length) {
        const newItems = original.items.map(({ id, character, characterId: _oldCharacterId, ...item }) => {
            const entity = queryRunner.manager.create(CharacterItem, { ...item });
            entity.characterId = savedClone.id;
            entity.character = savedClone;
            return entity;
        });
        await queryRunner.manager.save(newItems);
    }
    if (original.spells?.length) {
        const newSpells = original.spells.map(({ id, character, characterId: _oldCharacterId, ...spell }) => {
            const entity = queryRunner.manager.create(CharacterSpell, { ...spell });
            entity.characterId = savedClone.id;
            entity.character = savedClone;
            return entity;
        });
        await queryRunner.manager.save(newSpells);
    }
    if (original.relationships?.length) {
        for (const rel of original.relationships) {
            const { id, character, quests, ...relData } = rel;
            const newRel = queryRunner.manager.create(Relationship, { ...relData, characterId: savedClone.id });
            const savedRel = await queryRunner.manager.save(newRel);
            
            if (quests?.length) {
                for (const questEntry of quests) {
                    const { id: _oldQuestId, relationship: _oldRelationship, keywords, ...questData } = questEntry as Quest & {
                        keywords?: any[];
                    };
                    const newQuest = queryRunner.manager.create(Quest, { ...questData, relationshipId: savedRel.id });
                    const savedQuest = await queryRunner.manager.save(newQuest);
                    const keywordStrings = extractQuestKeywordStrings(keywords);
                    if (keywordStrings.length) {
                        await syncQuestKeywords(queryRunner.manager, savedQuest, keywordStrings);
                    }
                }
            }
        }
    }
    if (original.journal?.length) {
        const topLevelEntries = original.journal.filter(j => !j.parentLocation);
        await cloneJournalEntries(queryRunner, topLevelEntries, savedClone.id);
    }


    if (!qr) await queryRunner.commitTransaction();
    console.log('[cloneCharacter] Clone finalizado', {
        newCharacterId: savedClone.id,
        sessionId: savedClone.sessionId,
    });
    return savedClone;
  } catch (error) {
    if (!qr) await queryRunner.rollbackTransaction();
    console.error("Erro ao clonar personagem:", error);
    throw createError(500, "Falha ao clonar o personagem para a nova sessão.");
  } finally {
    if (!qr) await queryRunner.release();
  }
};


export const getCharactersForUser = async (userId: number) => {
    const characterRepository = AppDataSource.getRepository(Character);
    return characterRepository
        .createQueryBuilder('character')
        .where('character.userId = :userId', { userId })
        .andWhere('character.deletedAt IS NULL')
        .andWhere('character.isTemplate = true')
        .andWhere('character.sessionId IS NULL')
        .select(['character.id', 'character.name', 'character.race', 'character.characterClass', 'character.level', 'character.createdAt'])
        .getMany();
};

export const getCharacterById = async (characterId: number, userId: number) => {
    const characterRepository = AppDataSource.getRepository(Character);
    const character = await characterRepository.findOne({
        where: { id: characterId, userId, deletedAt: IsNull() },
        loadEagerRelations: false,
    });

    if (!character) {
        throw createError(404, 'Personagem não encontrado ou você não tem permissão.');
    }

    const full = await buildFullCharacterObject(character, { disableCache: true });
    console.log('[getCharacterById] retorno', { characterId, attributes: full.attributes, inventory: full.inventory?.length });
    return full;
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
        await redisClient.del(`character:${characterId}`, `character:${characterId}:optimized`);
    }
};
