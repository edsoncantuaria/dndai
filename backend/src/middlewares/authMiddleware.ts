
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { setRequestMetadata } from 'genkit/context';

// Estendendo a interface Request do Express para incluir o usuário
export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
  };
}

// Middleware para autenticar o token JWT e configurar o contexto para o Genkit
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

        // Adiciona o userId ao contexto da requisição para o Genkit usar
        setRequestMetadata({ auth: { userId: user.id } });
        
        next();
    });
};


// Este middleware é para passar o contexto de autenticação para o Genkit
// mesmo em rotas não protegidas, se o token existir.
export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    const secret = process.env.SECRET_KEY;
    if (secret) {
      jwt.verify(token, secret, (err: any, user: any) => {
        if (user) {
          setRequestMetadata({ auth: { userId: user.id }, source: 'authMiddleware' });
        }
        next();
      });
    } else {
        next();
    }
  } else {
    next();
  }
};
