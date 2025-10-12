// backend/src/middlewares/errorMiddleware.ts
import { Request, Response, NextFunction } from 'express';

const errorMiddleware = (err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(err); // Log do erro para debugging

    const statusCode = err.status || err.statusCode || 500;
    const message = err.message || 'Ocorreu um erro interno no servidor.';

    return res.status(statusCode).json({ message });
};

export default errorMiddleware;
