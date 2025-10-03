import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) {
        return res.status(401).json({ message: "Token não fornecido." });
    }

    const secret = process.env.SECRET_KEY;
    if (!secret) {
        return res.status(500).json({ message: "Chave secreta do servidor não configurada." });
    }

    jwt.verify(token, secret, (err: any, user: any) => {
        if (err) {
            return res.status(403).json({ message: "Token inválido ou expirado." });
        }
        (req as any).user = user;
        next();
    });
};
