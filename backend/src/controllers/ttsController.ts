import type { Request, Response, NextFunction } from 'express';
import createError from 'http-errors';
import {
  synthesizeNarrationAudio,
  isTtsAvailable,
  buildTtsPlaybackUrl,
  isValidTtsObjectKey,
} from '../services/ttsService.js';
import { isPiperVoiceId } from '../config/narrationTts.js';
import { fetchObjectBuffer, isObjectStorageEnabled } from '../services/objectStorageService.js';

export const generateNarrationAudio = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isTtsAvailable()) {
      throw createError(503, 'TTS não está configurado neste servidor.');
    }
    const { text, voice, lengthScale, narrationVoice, narrationSpeed } = req.body ?? {};
    if (typeof text !== 'string' || !text.trim()) {
      throw createError(400, 'Texto inválido para síntese.');
    }
    const audio = await synthesizeNarrationAudio(text, {
      voice: isPiperVoiceId(voice) ? voice : isPiperVoiceId(narrationVoice) ? narrationVoice : undefined,
      lengthScale: typeof lengthScale === 'number' ? lengthScale : undefined,
      settings: {
        narrationVoice: isPiperVoiceId(narrationVoice) ? narrationVoice : isPiperVoiceId(voice) ? voice : undefined,
        narrationSpeed,
      },
    });
    if (!audio?.key) {
      throw createError(500, 'Falha ao gerar o áudio solicitado.');
    }
    res.status(201).json({
      audioKey: audio.key,
      audioUrl: audio.url ?? buildTtsPlaybackUrl(audio.key),
    });
  } catch (error) {
    next(error);
  }
};

/** Proxy interno MinIO → cliente (só expõe backend + frontend). */
export const streamNarrationAudio = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isObjectStorageEnabled) {
      throw createError(503, 'Armazenamento de áudio não configurado.');
    }
    const key = typeof req.query.key === 'string' ? req.query.key.trim() : '';
    if (!key || !isValidTtsObjectKey(key)) {
      throw createError(400, 'Chave de áudio inválida.');
    }
    const object = await fetchObjectBuffer(key);
    if (!object) {
      throw createError(404, 'Áudio não encontrado.');
    }
    res.setHeader('Content-Type', object.contentType || 'audio/wav');
    res.setHeader('Content-Length', String(object.size));
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.send(object.buffer);
  } catch (error) {
    next(error);
  }
};

/** Compat: devolve URL do proxy (não assina MinIO). */
export const presignNarrationAudio = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const key = typeof req.query.key === 'string' ? req.query.key.trim() : '';
    if (!key || !isValidTtsObjectKey(key)) {
      throw createError(400, 'Parâmetro "key" inválido.');
    }
    res.json({ audioUrl: buildTtsPlaybackUrl(key) });
  } catch (error) {
    next(error);
  }
};
