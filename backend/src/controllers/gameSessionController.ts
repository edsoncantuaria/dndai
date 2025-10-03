
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import GameSession from '../models/GameSession';
import { z } from 'zod';
import { gameMasterFlow } from '../services/iaService';

const gameSessionSchema = z.object({
    characterId: z.number().int().positive(),
    state: z.object({}).passthrough(),
});

export const createGameSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { characterId, state } = gameSessionSchema.parse(req.body);

    // Validação adicional para garantir que o personagem pertence ao usuário pode ser adicionada aqui
    
    const newSession = await GameSession.create({
      userId,
      characterId,
      state,
    });
    res.status(201).json(newSession);
  } catch (error) {
    next(error);
  }
};

export const getLatestSessionForCharacter = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { characterId } = req.params;
    
    const session = await GameSession.findOne({
      where: { userId, characterId: Number(characterId) },
      order: [['createdAt', 'DESC']],
    });
    
    if (!session) {
      return res.status(404).json({ message: 'Nenhuma sessão de jogo encontrada para este personagem.' });
    }
    
    res.json(session);
  } catch (error) {
    next(error);
  }
};

const playerActionSchema = z.object({
  character: z.any(),
  playerAction: z.string(),
  gameLog: z.array(z.any()),
  combatState: z.any().optional(),
});

export const processPlayerAction = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const flowInput = playerActionSchema.parse(req.body);

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Transfer-Encoding', 'chunked');

        // Chama o fluxo diretamente e passa uma função para lidar com os chunks de streaming
        await gameMasterFlow(flowInput, (chunk) => {
          res.write(JSON.stringify(chunk) + '\n');
        });
        
        res.end();

    } catch (error) {
        next(error);
    }
};
