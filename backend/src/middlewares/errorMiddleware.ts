
// backend/src/middlewares/errorMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { HttpError } from 'http-errors';
import { ZodError } from 'zod';

// Mapeia códigos de status de erro do Google/Genkit para códigos de status HTTP
const statusMappings: { [key: string]: number } = {
    'INVALID_ARGUMENT': 400,
    'UNAUTHENTICATED': 401,
    'PERMISSION_DENIED': 403,
    'NOT_FOUND': 404,
    'ALREADY_EXISTS': 409,
    'RESOURCE_EXHAUSTED': 429,
    'CANCELLED': 499,
    'INTERNAL': 500,
    'UNAVAILABLE': 503,
    'UNKNOWN': 500,
};


/**
 * Middleware de tratamento de erros global.
 * Captura erros lançados em qualquer parte da aplicação e formata
 * uma resposta JSON padronizada.
 */
const errorMiddleware = (err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(err); // Loga o erro completo para debugging

    let statusCode: number;
    let responseBody: { message: string; stack?: string, details?: any } = { message: err.message || 'Ocorreu um erro interno no servidor.' };

    // Tratamento específico para erros de validação do Zod
    if (err instanceof ZodError) {
        statusCode = 400;
        responseBody.message = "Dados da requisição inválidos.";
        responseBody.details = err.flatten().fieldErrors;
    } else {
        // O 'status' de erros http-errors ou o 'code' de erros do Genkit
        const errorStatus = (err as HttpError).status || err.code;

        // Se o status for numérico (de http-errors), use-o.
        if (typeof errorStatus === 'number' && errorStatus >= 100 && errorStatus < 600) {
            statusCode = errorStatus;
        } 
        // Se for um status de string do Genkit/Google AI, mapeie para um código HTTP.
        else if (typeof errorStatus === 'string' && statusMappings[errorStatus]) {
            statusCode = statusMappings[errorStatus];
        }
        // Caso contrário, padrão para 500.
        else {
            statusCode = 500;
        }

        // Em ambiente de desenvolvimento, podemos enviar mais detalhes
        if (process.env.NODE_ENV === 'development') {
            responseBody.stack = err.stack;
            if(err.errors) {
                responseBody.details = err.errors;
            }
        }
    }


    res.status(statusCode).json(responseBody);
};

export default errorMiddleware;
