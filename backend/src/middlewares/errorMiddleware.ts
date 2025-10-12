// backend/src/middlewares/errorMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { isHttpError } from 'http-errors';

const errorMiddleware = (err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err); // Log do erro para debugging

    if (isHttpError(err)) {
        return res.status(err.statusCode).json({ message: err.message });
    }

    // Erro genérico do servidor
    return res.status(500).json({ message: 'Ocorreu um erro interno no servidor.' });
};

export default errorMiddleware;
