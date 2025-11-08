// backend/src/controllers/narrarController.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import * as NarrarService from '../services/narrarService.js';
import createError from 'http-errors';
import { z } from 'zod';
import { CombatStateSchema } from '../schemas/gameSchemas.js';

const narrarRequestSchema = z.object({
    prompt: z.string().min(1, 'A ação do jogador é obrigatória.'),
    combatState: CombatStateSchema.nullable().optional(),
    apiKey: z.string().min(8, 'A chave de API do usuário é obrigatória para a narração.'),
    useAiHomebrew: z.boolean().optional(),
});

export const narrar = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { sessionId } = req.params;
    const bodyValidation = narrarRequestSchema.safeParse(req.body);
    if (!bodyValidation.success) {
        return next(createError(400, 'Dados inválidos para narração.', { details: bodyValidation.error.flatten() }));
    }
    const { prompt: playerAction, combatState, apiKey, useAiHomebrew } = bodyValidation.data;
    const currentCombatState = combatState ?? undefined;
    const userId = req.user?.userId;

    if (!userId) {
        return next(createError(401, 'ID do usuário não encontrado no token.'));
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
