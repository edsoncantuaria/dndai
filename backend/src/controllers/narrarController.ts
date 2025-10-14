// backend/src/controllers/narrarController.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import * as NarrarService from '../services/narrarService.js';
import createError from 'http-errors';

export const narrar = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { sessionId } = req.params;
    const { prompt: playerAction, combatState: currentCombatState } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
        return next(createError(401, 'ID do usuário não encontrado no token.'));
    }
    if (!playerAction) {
        return next(createError(400, 'A ação do jogador (prompt) é obrigatória.'));
    }
    const sessionIdNum = Number(sessionId);
    if(isNaN(sessionIdNum)) {
        return next(createError(400, 'ID de sessão inválido.'));
    }

    try {
        const aiResponse = await NarrarService.processPlayerTurn(
            sessionIdNum, 
            userId, 
            playerAction, 
            currentCombatState
        );
        
        res.status(200).json(aiResponse);

    } catch (error) {
        next(error);
    }
};
