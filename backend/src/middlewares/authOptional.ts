// backend/src/middlewares/authOptional.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Estendendo a interface Request para incluir a propriedade opcional 'user'
interface OptionalAuthRequest extends Request {
  user?: { userId: number };
}

export function authOptional(req: OptionalAuthRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      // Verifica o token e decodifica o payload
      const payload: any = jwt.verify(token, process.env.JWT_SECRET as string);
      // Atribui o ID do usuário à requisição para uso posterior nas rotas
      req.user = { userId: payload?.userId }; 
    } catch (error) {
      // Se o token for inválido (expirado, malformado), ignora o erro e continua
      // a requisição como se o usuário não estivesse autenticado.
      // Isso é crucial para permitir acesso público enquanto ainda se tenta
      // identificar um usuário logado.
      console.warn('[AuthOptional] Token inválido ou expirado, tratando como usuário anônimo.');
    }
  }
  // Continua para a próxima função de middleware, com ou sem a identificação do usuário.
  next();
}
