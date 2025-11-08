// backend/src/controllers/aiController.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware.js';
import * as AiCreationService from '../services/aiCreationService.js';
import createError from 'http-errors';
import { z } from 'zod';

const ALLOWED_TYPES = ['race', 'subrace', 'class', 'subclass', 'spell', 'item', 'monster', 'background', 'feat', 'skill', 'translation'] as const;

const homebrewRequestSchema = z.object({
    prompt: z.string().min(1, 'Prompt é obrigatório.'),
    type: z.enum(ALLOWED_TYPES, { errorMap: () => ({ message: 'Tipo de conteúdo inválido.' }) }),
    apiKey: z.string().min(8, 'Chave de API inválida.'),
});

export const createHomebrew = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    if (!userId) {
        return next(createError(401, 'Usuário não autenticado.'));
    }

    try {
        const validation = homebrewRequestSchema.safeParse(req.body);
        if (!validation.success) {
            return next(createError(400, 'Dados inválidos para criação de homebrew.', { details: validation.error.flatten() }));
        }
        const { prompt, type, apiKey } = validation.data;
        
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
