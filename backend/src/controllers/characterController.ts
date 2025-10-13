// backend/src/controllers/characterController.ts
import { Response, NextFunction } from 'express';
import { AppDataSource } from '../database/data-source.js';
import { Character } from '../entities/Character.js';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import createError from 'http-errors';
import { IsNull } from 'typeorm';
import { CharacterAttributes } from '../entities/CharacterAttributes.js';
import { CharacterProficiency } from '../entities/CharacterProficiency.js';
import { CharacterItem } from '../entities/CharacterItem.js';
import { CharacterSpell } from '../entities/CharacterSpell.js';
import { JournalEntry } from '../entities/JournalEntry.js';
import { Relationship } from '../entities/Relationship.js';
import { Quest } from '../entities/Quest.js';


// Função auxiliar para reconstruir o objeto completo do personagem
const buildFullCharacterObject = async (character: Character) => {
    // Isso é necessário porque o find não carrega relações aninhadas profundamente por padrão
    const fullCharacter = await AppDataSource.getRepository(Character).findOne({
        where: { id: character.id },
        relations: [
            "attributes",
            "proficiencies",
            "items",
            "spells",
            "sessoes",
            "sessoes.character",
            "journal",
            "relationships",
            "relationships.quests",
        ],
    });
    if (!fullCharacter) return character; // Retorna o básico se não encontrar
    
    // Transforma as entidades de volta para o formato que o frontend espera
    const characterData = {
        ...fullCharacter,
        attributes: fullCharacter.attributes,
        proficiencies: fullCharacter.proficiencies,
        inventory: fullCharacter.items.map(item => item.itemData), // Corrigido para pegar o JSON
        spells: fullCharacter.spells.map(s => s.spellName),
        journal: fullCharacter.journal,
        relationships: fullCharacter.relationships,
    };

    // Remove as propriedades de relação para evitar redundância
    delete (characterData as any).items;
    
    return characterData;
};


// Criar um novo personagem
export const createCharacter = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const characterData = req.body;
    const userId = req.user?.userId;

    if (!characterData || !characterData.name) {
        return next(createError(400, 'Dados do personagem são inválidos.'));
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        // 1. Criar e salvar a entidade Character principal
        const newCharacter = new Character();
        newCharacter.userId = userId!;
        newCharacter.name = characterData.name;
        newCharacter.race = characterData.race;
        newCharacter.subrace = characterData.subrace;
        newCharacter.characterClass = characterData.characterClass;
        newCharacter.level = characterData.level;
        newCharacter.background = characterData.background;
        newCharacter.alignment = characterData.alignment;
        newCharacter.backstory = characterData.backstory;
        newCharacter.ideal = characterData.ideal;
        newCharacter.bond = characterData.bond;
        newCharacter.flaw = characterData.flaw;
        newCharacter.sex = characterData.sex;
        newCharacter.hairStyle = characterData.hairStyle;
        newCharacter.beardStyle = characterData.beardStyle;
        newCharacter.skinColor = characterData.skinColor;
        
        const savedCharacter = await queryRunner.manager.save(newCharacter);

        // 2. Criar e salvar CharacterAttributes
        const attributes = new CharacterAttributes();
        Object.assign(attributes, characterData.attributes);
        attributes.character = savedCharacter;
        await queryRunner.manager.save(attributes);

        // 3. Criar e salvar CharacterProficiency (array)
        const proficiencies = characterData.proficiencies.map((p: any) => {
            const prof = new CharacterProficiency();
            prof.character = savedCharacter;
            prof.name = p.name;
            prof.type = p.url?.includes('skill') ? 'skill' : (p.url?.includes('language') ? 'language' : 'other');
            return prof;
        });
        await queryRunner.manager.save(proficiencies);

        // 4. Criar e salvar CharacterItem (inventário)
        const items = characterData.inventory.map((item: any) => {
            const charItem = new CharacterItem();
            charItem.character = savedCharacter;
            charItem.name = item.name;
            charItem.quantity = item.quantity;
            charItem.itemData = item; // Armazena o objeto completo do item para referência
            return charItem;
        });
        await queryRunner.manager.save(items);

        // 5. Criar e salvar CharacterSpell (magias)
        const spells = characterData.spells.map((spellName: string) => {
            const charSpell = new CharacterSpell();
            charSpell.character = savedCharacter;
            charSpell.spellName = spellName;
            return charSpell;
        });
        await queryRunner.manager.save(spells);
        
        // Se tudo deu certo, commita a transação
        await queryRunner.commitTransaction();

        res.status(201).json({ message: 'Personagem criado com sucesso!', character: savedCharacter });

    } catch (error) {
        // Se algo der errado, desfaz tudo
        await queryRunner.rollbackTransaction();
        next(error);
    } finally {
        // Libera o query runner
        await queryRunner.release();
    }
};

// Listar todos os personagens do usuário
export const getCharacters = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;

    try {
        const characterRepository = AppDataSource.getRepository(Character);
        const characters = await characterRepository.find({
            where: { userId: userId!, deletedAt: IsNull() },
            select: ["id", "name", "race", "characterClass", "level", "createdAt"] // Campos para a lista
        });
        res.status(200).json(characters);
    } catch (error) {
        next(error);
    }
};

// Obter detalhes de um personagem específico
export const getCharacterById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.user?.userId;

    try {
        const characterRepository = AppDataSource.getRepository(Character);
        const character = await characterRepository.findOne({
            where: { id: Number(id), userId: userId!, deletedAt: IsNull() },
            relations: [
                "attributes",
                "proficiencies",
                "items",
                "spells",
                "journal",
                "relationships",
                "relationships.quests",
            ],
        });

        if (!character) {
            return next(createError(404, 'Personagem não encontrado ou você não tem permissão.'));
        }

        // Reconstroi o objeto completo para enviar ao frontend
        const fullCharacterData = await buildFullCharacterObject(character);
        res.status(200).json(fullCharacterData);

    } catch (error) {
        next(error);
    }
};

// Deletar um personagem (soft delete)
export const deleteCharacter = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.user?.userId;

    try {
        const characterRepository = AppDataSource.getRepository(Character);
        const result = await characterRepository.softDelete({ id: Number(id), userId: userId! });

        if (result.affected === 0) {
            return next(createError(404, 'Personagem não encontrado ou você não tem permissão para deletá-lo.'));
        }

        res.status(200).json({ message: 'Personagem movido para a lixeira com sucesso.' });
    } catch (error) {
        next(error);
    }
};
