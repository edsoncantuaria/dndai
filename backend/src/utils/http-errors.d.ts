
// backend/src/utils/http-errors.d.ts

/**
 * Este arquivo de declaração de tipos é necessário porque a biblioteca `http-errors`
 * não fornece tipos TypeScript por padrão. Ele ajuda o TypeScript a entender
 * a estrutura dos erros criados pela biblioteca, melhorando o autocompletar e a
 * segurança de tipo no middleware de erro.
 */
declare module 'http-errors' {
    interface HttpError extends Error {
        status: number;
        statusCode: number;
        expose: boolean;
        headers?: {
            [key: string]: string;
        };
    }

    interface HttpErrorConstructor {
        new(status?: number, message?: string, props?: object): HttpError;
        (status?: number, message?: string, props?: object): HttpError;
    }

    const createError: HttpErrorConstructor;

    export = createError;
}
