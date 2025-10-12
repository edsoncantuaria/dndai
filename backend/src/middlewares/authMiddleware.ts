// backend/src/middlewares/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import createError from 'http-errors';

const JWT_SECRET = process.env.JWT_SECRET || 'seu_segredo_jwt_super_secreto';

const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(createError(401, 'Token de autenticação não fornecido.'));
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        (req as any).user = decoded; // Anexa os dados do usuário ao objeto req
        next();
    } catch (error) {
        return next(createError(401, 'Token inválido ou expirado.'));
    }
};

export default authMiddleware;
