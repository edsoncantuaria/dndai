// backend/src/controllers/aiController.ts
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as AiCreationService from '../services/aiCreationService.js';
import createError from 'http-errors';

const CreateHomebrewPayloadSchema = z.object({
    prompt: z.string(),
    type: z.enum(['race', 'subrace', 'class', 'subclass', 'spell', 'item', 'monster', 'background', 'feat']),
    apiKey: z.string(),
});

export const createHomebrew = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { prompt, type, apiKey } = CreateHomebrewPayloadSchema.parse(req.body);
        const result = await AiCreationService.createHomebrewContent({ prompt, type, apiKey });
        res.status(200).json(result);
    } catch (error: any) {
        if (error.name === 'ZodError') {
            return next(createError(400, { errors: error.flatten().fieldErrors }));
        }
        next(error);
    }
};

// Futuramente, podemos adicionar controladores para TTS e Geração de Imagem aqui.
// export const generateImage = async...
// export const textToSpeech = async...
