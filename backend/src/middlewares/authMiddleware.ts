// backend/src/middlewares/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import createError from 'http-errors';

export interface AuthRequest extends Request {
    user?: { userId: number };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(createError(401, 'Token de autenticação não fornecido ou mal formatado.'));
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_default_secret') as { userId: number };
        req.user = decoded;
        next();
    } catch (error) {
        return next(createError(401, 'Token inválido ou expirado.'));
    }
};
