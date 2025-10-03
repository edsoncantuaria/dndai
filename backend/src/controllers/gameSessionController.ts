
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware';
import GameSession from '../models/GameSession';
import Character from '../models/Character';
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

// Schema atualizado: espera characterId em vez do objeto de personagem completo.
const playerActionSchema = z.object({
  characterId: z.number().int().positive(),
  playerAction: z.string(),
  gameLog: z.array(z.any()),
  combatState: z.any().optional(),
});


export const processPlayerAction = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const { characterId, playerAction, gameLog, combatState } = playerActionSchema.parse(req.body);
        const userId = req.user!.id;
        
        // Busca o personagem no banco de dados.
        const character = await Character.findOne({ where: { id: characterId, userId }});
        if (!character) {
            return res.status(404).json({ message: "Personagem não encontrado ou não pertence a este usuário." });
        }
        
        // Monta o input para o fluxo da IA com os dados corretos do personagem.
        const flowInput = {
            character: character.stats, // Usa os dados do personagem do BD
            playerAction,
            gameLog,
            combatState,
        };

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');

        // A chamada do fluxo de streaming permanece a mesma.
        const response = await gameMasterFlow(flowInput, (chunk) => {
            res.write(JSON.stringify(chunk));
        });

        res.end();

    } catch (error) {
        next(error);
    }
};
