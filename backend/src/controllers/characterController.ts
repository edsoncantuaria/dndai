// backend/src/controllers/characterController.ts
import { Response, NextFunction } from 'express';
import { AppDataSource } from '../database/data-source.js';
import { Character } from '../entities/Character.js';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import createError from 'http-errors';
import { IsNull } from 'typeorm';

// Criar um novo personagem
export const createCharacter = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const characterData = req.body;
    const userId = req.user?.userId;

    if (!characterData || !characterData.name) {
        return next(createError(400, 'Dados do personagem são inválidos.'));
    }

    try {
        const characterRepository = AppDataSource.getRepository(Character);
        const novoPersonagem = new Character();
        novoPersonagem.userId = userId!;
        novoPersonagem.name = characterData.name;
        novoPersonagem.characterClass = characterData.characterClass;
        novoPersonagem.race = characterData.race;
        novoPersonagem.level = characterData.level;
        novoPersonagem.characterData = characterData; // Salva o objeto completo

        const personagemSalvo = await characterRepository.save(novoPersonagem);

        res.status(201).json({ message: 'Personagem criado com sucesso!', character: personagemSalvo });
    } catch (error) {
        next(error);
    }
};

// Listar todos os personagens do usuário
export const getCharacters = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;

    try {
        const characterRepository = AppDataSource.getRepository(Character);
        // Seleciona apenas os campos necessários para a lista de personagens
        const characters = await characterRepository.find({
            where: { userId: userId!, deletedAt: IsNull() },
            select: ["id", "name", "race", "characterClass", "level", "createdAt"]
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
            where: { id: Number(id), userId: userId!, deletedAt: IsNull() }
        });

        if (!character) {
            return next(createError(404, 'Personagem não encontrado ou você não tem permissão.'));
        }

        res.status(200).json(character);
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
