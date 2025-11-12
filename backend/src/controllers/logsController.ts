// backend/src/controllers/logsController.ts
import { Response, NextFunction } from 'express';
import createError from 'http-errors';
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import { SessionLog } from '../entities/SessionLog.js';
import type { AuthRequest } from '../middlewares/authMiddleware.js';
import { getObjectUrl, getSignedObjectUrl } from '../services/objectStorageService.js';

const MAX_INLINE_PREVIEW = 1200;
const DEFAULT_LIMIT = 120;
const MAX_LIMIT = 500;

interface StoragePointer {
  storage: string;
  provider?: string;
  bucket?: string;
  key: string;
  contentType?: string;
  size?: number;
}

const safeJsonParse = (value: string | null | undefined) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const isStoragePointer = (value: unknown): value is StoragePointer =>
  typeof value === 'object' &&
  value !== null &&
  (value as StoragePointer).storage === 's3' &&
  typeof (value as StoragePointer).key === 'string';

const stringifyPayload = (payload: unknown): string => {
  if (payload === null || payload === undefined) return '';
  if (typeof payload === 'string') return payload;
  return JSON.stringify(payload);
};

const formatSessionLog = async (log: SessionLog) => {
  const parsed = safeJsonParse(log.response);
  if (isStoragePointer(parsed)) {
    const signedUrl = await getSignedObjectUrl(parsed.key);
    return {
      id: log.id,
      type: log.type,
      prompt: log.prompt,
      timestamp: log.timestamp.toISOString(),
      payload: {
        kind: 'external' as const,
        provider: parsed.provider ?? 'minio',
        bucket: parsed.bucket,
        key: parsed.key,
        url: signedUrl ?? getObjectUrl(parsed.key),
        contentType: parsed.contentType,
        size: parsed.size,
      },
      rollResult: log.rollResult ?? undefined,
    };
  }

  const raw = stringifyPayload(parsed ?? log.response ?? '');
  const truncated = raw.length > MAX_INLINE_PREVIEW;
  const preview = truncated ? `${raw.slice(0, MAX_INLINE_PREVIEW)}…` : raw;

  return {
    id: log.id,
    type: log.type,
    prompt: log.prompt,
    timestamp: log.timestamp.toISOString(),
    payload: {
      kind: 'inline' as const,
      preview,
      truncated,
    },
    rollResult: log.rollResult ?? undefined,
  };
};

export const getSessionLogs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { sessionId } = req.params;
  const userId = req.user?.userId;
  if (!userId) {
    return next(createError(401, 'Usuário não autenticado.'));
  }

  const sessaoId = Number(sessionId);
  if (Number.isNaN(sessaoId)) {
    return next(createError(400, 'ID da sessão inválido.'));
  }

  const limitParam = Number(req.query.limit);
  const limit = Number.isNaN(limitParam)
    ? DEFAULT_LIMIT
    : Math.min(Math.max(limitParam, 1), MAX_LIMIT);

  try {
    const sessaoRepo = AppDataSource.getRepository(SessaoIA);
    const sessao = await sessaoRepo.findOne({ where: { id: sessaoId, userId }, select: ['id'] });
    if (!sessao) {
      return next(createError(404, 'Sessão não encontrada ou você não tem permissão.'));
    }

    const logRepository = AppDataSource.getRepository(SessionLog);
    const logs = await logRepository.find({
      where: { sessaoId },
      order: { timestamp: 'DESC' },
      take: limit,
    });

    const entries = await Promise.all(logs.map(formatSessionLog));
    res.json({
      sessionId: sessaoId,
      count: entries.length,
      entries,
    });
  } catch (error) {
    next(error);
  }
};
