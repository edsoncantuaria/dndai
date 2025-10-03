
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

// Middleware para tratamento de erros
export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(err.stack);

  if (err instanceof ZodError) {
    return res.status(400).json({
      message: 'Erro de validação',
      errors: err.errors,
    });
  }

  // Tratamento de outros tipos de erro pode ser adicionado aqui
  // ex: if (err instanceof CustomError) { ... }

  res.status(500).json({ message: 'Erro interno do servidor' });
};
