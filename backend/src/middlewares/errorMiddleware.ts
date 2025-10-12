
// backend/src/middlewares/errorMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { HttpError } from 'http-errors';

/**
 * Middleware de tratamento de erros global.
 * Captura erros lançados em qualquer parte da aplicação e formata
 * uma resposta JSON padronizada.
 */
const errorMiddleware = (err: Error | HttpError, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack); // Loga o stack completo do erro para debugging

    const statusCode = (err as HttpError).status || 500;
    const message = err.message || 'Ocorreu um erro interno no servidor.';

    // Em ambiente de desenvolvimento, podemos enviar mais detalhes
    const responseBody: { message: string; stack?: string } = { message };
    if (process.env.NODE_ENV === 'development') {
        responseBody.stack = err.stack;
    }

    res.status(statusCode).json(responseBody);
};

export default errorMiddleware;
