
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import Character from '../models/Character';
import { z } from 'zod';


const characterSchema = z.object({
  name: z.string().min(1, "O nome do personagem é obrigatório."),
  level: z.number().int().positive().default(1),
  stats: z.object({}).passthrough(), // Permite qualquer estrutura JSON para os status
});

export const createCharacter = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { name, level, stats } = characterSchema.parse(req.body);
    const userId = req.user!.id;

    const newCharacter = await Character.create({
      userId,
      name,
      level,
      stats,
    });

    res.status(201).json(newCharacter);
  } catch (error) {
    next(error);
  }
};

export const getAllCharactersForUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const characters = await Character.findAll({ where: { userId } });
    res.json(characters);
  } catch (error) {
    next(error);
  }
};

export const getCharacterById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const character = await Character.findOne({ where: { id, userId } });

    if (!character) {
      return res.status(404).json({ message: 'Personagem não encontrado ou não pertence a este usuário.' });
    }
    res.json(character);
  } catch (error) {
    next(error);
  }
};

export const updateCharacter = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    
    const dataToUpdate = characterSchema.partial().parse(req.body);

    const character = await Character.findOne({ where: { id, userId } });

    if (!character) {
      return res.status(404).json({ message: 'Personagem não encontrado ou não pertence a este usuário.' });
    }
    
    await character.update(dataToUpdate);
    res.json(character);
  } catch (error) {
    next(error);
  }
};

export const deleteCharacter = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const character = await Character.findOne({ where: { id, userId } });
    if (!character) {
      return res.status(404).json({ message: 'Personagem não encontrado ou não pertence a este usuário.' });
    }

    await character.destroy();
    res.status(204).send(); // No Content
  } catch (error) {
    next(error);
  }
};
