import type { Request, Response, NextFunction } from 'express';
import createError from 'http-errors';
import { synthesizeNarrationAudio, isTtsAvailable } from '../services/ttsService.js';

export const generateNarrationAudio = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isTtsAvailable()) {
      throw createError(503, 'TTS não está configurado neste servidor.');
    }
    const { text } = req.body ?? {};
    if (typeof text !== 'string' || !text.trim()) {
      throw createError(400, 'Texto inválido para síntese.');
    }
    const audio = await synthesizeNarrationAudio(text);
    if (!audio?.url) {
      throw createError(500, 'Falha ao gerar o áudio solicitado.');
    }
    res.status(201).json({ audioUrl: audio.url });
  } catch (error) {
    next(error);
  }
};
