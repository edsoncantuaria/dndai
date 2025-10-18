// backend/src/controllers/aiController.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import * as AiCreationService from '../services/aiCreationService.js';
import createError from 'http-errors';

export const createHomebrew = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    if (!userId) {
        return next(createError(401, 'Usuário não autenticado.'));
    }

    try {
        const { prompt, type, apiKey } = req.body;
        if (!prompt || !type || !apiKey) {
            return next(createError(400, 'Prompt, tipo e chave de API são obrigatórios.'));
        }
        
        const result = await AiCreationService.generateHomebrewContent({ prompt, type, apiKey });
        
        if (result && result.content) {
            res.status(200).json(result);
        } else {
            throw createError(500, "A IA não conseguiu gerar o conteúdo solicitado.");
        }

    } catch (error) {
        next(error);
    }
};
