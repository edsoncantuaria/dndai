// backend/src/middlewares/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import createError from 'http-errors';

export interface AuthRequest extends Request {
    user?: { userId: number };
}

/** Aceita JWT no header ou em `?access_token=` (ex.: `<audio src>` não envia Authorization). */
export const authMiddlewareAllowQueryToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if ((!header || !header.startsWith('Bearer ')) && typeof req.query.access_token === 'string') {
        req.headers.authorization = `Bearer ${req.query.access_token}`;
    }
    return authMiddleware(req, res, next);
};

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(createError(401, 'Token de autenticação não fornecido ou mal formatado.'));
    }

    const token = authHeader.split(' ')[1];

    try {
        // Removido o valor padrão 'your_default_secret'
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: number };
        req.user = decoded;
        next();
    } catch (error) {
        return next(createError(401, 'Token inválido ou expirado.'));
    }
};
