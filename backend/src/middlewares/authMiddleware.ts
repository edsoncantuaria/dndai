
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ContextProvider, RequestData } from 'genkit/context';
import { UserFacingError } from 'genkit';


// Define um tipo para o nosso contexto de autenticação personalizado
interface CustomAuthContext {
  auth?: {
    userId: number;
  };
}

// Cria um provedor de contexto para o Genkit
export const authContext: ContextProvider<CustomAuthContext> = async (req: RequestData) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // Embora o authenticateToken já bloqueie, é uma boa prática ser explícito aqui.
    throw new UserFacingError('UNAUTHENTICATED', 'Token não fornecido no contexto do Genkit.');
  }

  const secret = process.env.SECRET_KEY;
  if (!secret) {
    throw new Error('Chave secreta JWT não configurada no servidor.');
  }

  try {
    const decoded: any = jwt.verify(token, secret);
    return {
      auth: {
        userId: decoded.id,
      },
    };
  } catch (err) {
    throw new UserFacingError('UNAUTHENTICATED', 'Token inválido ou expirado no contexto do Genkit.');
  }
};


// Estendendo a interface Request do Express para incluir o usuário
export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
  };
}

// Middleware para autenticar o token JWT e proteger as rotas
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
