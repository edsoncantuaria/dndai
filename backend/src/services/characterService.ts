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
import * as HomebrewService from './homebrewService.js';
import * as DndApiService from './dndApiService.js';

// Função auxiliar para reconstruir o objeto completo do personagem para o frontend
export const buildFullCharacterObject = async (character: Character) => {
    const fullCharacter = await AppDataSource.getRepository(Character).findOne({
        where: { id: character.id },
        relations: [
            "attributes", "proficiencies", "items", "spells",
            "journal", "journal.subLocations",
            "relationships", "relationships.quests",
        ],
    });
    if (!fullCharacter) return character;

    // A UI espera que `inventory` contenha os dados dos itens.
    // O backend armazena `itemData` dentro da entidade CharacterItem.
    // Mapeamos para o formato esperado.
    const inventory = fullCharacter.items.map((item: CharacterItem) => ({ 
        ...item.itemData, 
        id: item.id.toString(), // Garante que o ID do item da tabela seja usado
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
    
    return characterData;
};

// Helper to check if a string is a UUID
const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);


// Helper to get or create a detailed, reusable homebrew item
const getOrCreateReusableItem = async (userId: number, itemName: string, itemDetails: any) => {
    const reusableItem = await HomebrewService.findHomebrewContentByName(itemName, 'item');
    if (reusableItem) {
        return reusableItem.content;
    }
    // If not found, create it as a new homebrew entry for future reuse
    const newHomebrewItem = await HomebrewService.createHomebrewContent(userId, {
        name: itemName,
        type: 'item',
        content: {
            ...itemDetails,
            index: itemDetails.index || itemName.toLowerCase().replace(/\s+/g, '-'),
            name: itemName,
        },
        isPublic: true, // Make these descriptive items public by default
        createdBy: 'ai', // Mark as AI-created
    });
    return newHomebrewItem.content;
}


export const createCharacter = async (userId: number, characterData: z.infer<typeof NewCharacterInfoSchema>) => {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        
        let classDetails: any;
        if (isUuid(characterData.characterClass)) {
            const hbClass = await HomebrewService.getHomebrewContentById(characterData.characterClass, userId);
            classDetails = hbClass?.content;
        } else {
            // FIX: Convert class index to lowercase for API call
            classDetails = await DndApiService.getDetails('classes', characterData.characterClass.toLowerCase());
        }

        if (!classDetails) {
            throw createError(404, `A classe '${characterData.characterClass}' não foi encontrada.`);
        }
        
        const itemPromises = characterData.inventory.map(async (itemData: any) => {
            // Handle special descriptive items by making them reusable homebrew content
            if (itemData.index === 'signet-ring' || itemData.index === 'scroll-of-pedigree' || itemData.index === 'clothes-fine') {
                 const reusableContent = await getOrCreateReusableItem(userId, itemData.name, {
                    ...itemData,
                    desc: itemData.desc || [`Um item com uma história para ser descoberta.`]
                });
                return { ...reusableContent, quantity: itemData.quantity || 1, equipped: false, id: '' };
            }
            return { ...itemData, quantity: itemData.quantity || 1 };
        });

        const detailedItems = await Promise.all(itemPromises);
        
        // Extract gold from pouches
        let startingGold = 0;
        const finalInventoryItems = detailedItems.filter(item => {
            if (item.index === 'pouch' && item.desc?.[0]?.toLowerCase().includes('gp')) {
                 const match = item.desc[0].match(/(\d+)\s*gp/);
                if (match) {
                    startingGold += parseInt(match[1], 10);
                }
                // Keep the pouch, but without the gold description for cleaner data.
                item.desc = ['Uma simples bolsa de couro ou tecido.'];
            }
            return item.index !== 'gp'; // Filter out any explicit "gp" items if they exist
        });


        const newCharacter = new Character();
        Object.assign(newCharacter, {
            userId,
            name: characterData.name,
            race: characterData.race,
            subrace: characterData.subrace,
            characterClass: classDetails.name, // Usar o nome da classe, não o index
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

        const items = finalInventoryItems.map(itemData => {
            const charItem = new CharacterItem();
            charItem.character = savedCharacter;
            charItem.name = itemData.name;
            charItem.quantity = itemData.quantity;
            charItem.itemData = itemData; // Store the full (potentially homebrewed) item data
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
