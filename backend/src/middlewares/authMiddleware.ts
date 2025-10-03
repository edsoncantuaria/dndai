
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Estendendo a interface Request do Express para incluir o usuário
export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
  };
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato "Bearer TOKEN"

    if (token == null) {
        return res.status(401).json({ message: "Token não fornecido." });
    }

    const secret = process.env.SECRET_KEY;
    if (!secret) {
        console.error("Chave secreta JWT não está configurada no .env");
        return res.status(500).json({ message: "Erro de configuração do servidor." });
    }

    jwt.verify(token, secret, (err: any, user: any) => {
        if (err) {
            return res.status(403).json({ message: "Token inválido ou expirado." });
        }
        
        req.user = user as { id: number };
        next();
    });
};
