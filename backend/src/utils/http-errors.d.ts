// backend/src/utils/http-errors.d.ts

// This declaration file is necessary because http-errors doesn't have default TS types.
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
