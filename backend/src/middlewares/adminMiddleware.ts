// backend/src/middlewares/adminMiddleware.ts
import { Response, NextFunction } from 'express';
import createError from 'http-errors';
import { AuthRequest } from './authMiddleware.js';

const ADMIN_USER_ID = 1;

export const adminOnly = (req: AuthRequest, _res: Response, next: NextFunction) => {
  const userId = req.user?.userId;
  if (userId !== ADMIN_USER_ID) {
    return next(createError(403, 'Acesso restrito ao administrador.'));
  }
  next();
};
