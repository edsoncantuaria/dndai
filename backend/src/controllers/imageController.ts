import type { Response, NextFunction } from 'express';
import { z } from 'zod';
import createError from 'http-errors';
import type { AuthRequest } from '../middlewares/authMiddleware.js';
import {
  generateSceneImage,
  getSignedImageUrl,
  isImageGenerationAvailable,
} from '../services/imageGenerationService.js';

const generateImageSchema = z.object({
  prompt: z.string().min(1, 'O prompt da imagem é obrigatório.'),
  apiKey: z.string().min(8, 'Chave de API inválida.'),
});

export const generateImageController = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = generateImageSchema.safeParse(req.body);
    if (!parsed.success) {
      throw createError(400, 'Dados inválidos para geração de imagem.', { details: parsed.error.flatten() });
    }
    const { prompt, apiKey } = parsed.data;

    if (!isImageGenerationAvailable(apiKey)) {
      throw createError(503, 'Geração de imagens está desabilitada no momento.');
    }

    const image = await generateSceneImage(prompt, apiKey);
    if (!image?.key) {
      throw createError(500, 'Falha ao gerar a imagem solicitada.');
    }

    res.status(201).json({
      imageUrl: image.url,
      imageKey: image.key,
      size: image.size,
      contentType: image.contentType,
    });
  } catch (error) {
    next(error);
  }
};

export const presignImageController = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { key } = req.query;
    if (typeof key !== 'string' || !key.trim()) {
      throw createError(400, 'Parâmetro "key" inválido.');
    }

    const url = await getSignedImageUrl(key);
    if (!url) {
      throw createError(404, 'Não foi possível gerar a URL assinada para esta imagem.');
    }

    res.json({ imageUrl: url });
  } catch (error) {
    next(error);
  }
};
