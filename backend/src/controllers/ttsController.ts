import type { Request, Response, NextFunction } from 'express';
import createError from 'http-errors';
import { synthesizeNarrationAudio, isTtsAvailable, getSignedNarrationUrl } from '../services/ttsService.js';

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
    if (!audio?.url || !audio.key) {
      throw createError(500, 'Falha ao gerar o áudio solicitado.');
    }
    res.status(201).json({ audioUrl: audio.url, audioKey: audio.key });
  } catch (error) {
    next(error);
  }
};

export const presignNarrationAudio = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isTtsAvailable()) {
      throw createError(503, 'TTS não está configurado neste servidor.');
    }
    const { key } = req.query;
    if (typeof key !== 'string' || !key.trim()) {
      throw createError(400, 'Parâmetro "key" inválido.');
    }
    const url = await getSignedNarrationUrl(key);
    if (!url) {
      throw createError(404, 'Não foi possível gerar URL assinada para o áudio solicitado.');
    }
    res.json({ audioUrl: url });
  } catch (error) {
    next(error);
  }
};
