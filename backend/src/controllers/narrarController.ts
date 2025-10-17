// backend/src/controllers/narrarController.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import * as NarrarService from '../services/narrarService.js';
import createError from 'http-errors';

export const narrar = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { sessionId } = req.params;
    // Extrai a apiKey e o resto do corpo da requisição
    const { prompt: playerAction, combatState: currentCombatState, apiKey, useAiHomebrew } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
        return next(createError(401, 'ID do usuário não encontrado no token.'));
    }
    if (!playerAction) {
        return next(createError(400, 'A ação do jogador (prompt) é obrigatória.'));
    }
    // Adiciona validação para a apiKey
    if (!apiKey) {
        return next(createError(400, 'A chave de API do usuário é obrigatória para a narração.'));
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
            apiKey, // Passa a chave de API para o serviço
            currentCombatState,
            useAiHomebrew // Passa a configuração de homebrew
        );
        
        res.status(200).json(aiResponse);

    } catch (error) {
        next(error);
    }
};
