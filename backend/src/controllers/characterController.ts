// backend/src/controllers/characterController.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import { NewCharacterInfoSchema } from '../schemas/validationSchemas.js';
import * as CharacterService from '../services/characterService.js';
import createError from 'http-errors';

// Criar um novo personagem
export const createCharacter = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    if (!userId) {
        return next(createError(401, 'ID do usuário não encontrado no token.'));
    }

    try {
        const characterData = NewCharacterInfoSchema.parse(req.body);
        const savedCharacter = await CharacterService.createCharacter(userId, characterData);
        res.status(201).json({ message: 'Personagem criado com sucesso!', character: savedCharacter });

    } catch (error: any) {
        if (error.name === 'ZodError') {
            return next(createError(400, { errors: error.flatten().fieldErrors }));
        }
        next(error);
    }
};

// Listar todos os personagens do usuário
export const getCharacters = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
     if (!userId) {
        return next(createError(401, 'ID do usuário não encontrado no token.'));
    }

    try {
        const characters = await CharacterService.getCharactersForUser(userId);
        res.status(200).json(characters);
    } catch (error) {
        next(error);
    }
};

// Obter detalhes de um personagem específico
export const getCharacterById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.user?.userId;
     if (!userId) {
        return next(createError(401, 'ID do usuário não encontrado no token.'));
    }

    try {
        const characterId = Number(id);
        if (isNaN(characterId)) {
            return next(createError(400, 'ID do personagem inválido.'));
        }
        const fullCharacterData = await CharacterService.getCharacterById(characterId, userId);
        res.status(200).json(fullCharacterData);

    } catch (error) {
        next(error);
    }
};

// Deletar um personagem (soft delete)
export const deleteCharacter = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = req.user?.userId;
     if (!userId) {
        return next(createError(401, 'ID do usuário não encontrado no token.'));
    }

    try {
        const characterId = Number(id);
        if (isNaN(characterId)) {
            return next(createError(400, 'ID do personagem inválido.'));
        }
        await CharacterService.deleteCharacter(characterId, userId);
        res.status(200).json({ message: 'Personagem movido para a lixeira com sucesso.' });
    } catch (error) {
        next(error);
    }
};
