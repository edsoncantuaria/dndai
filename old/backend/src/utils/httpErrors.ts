type HttpErrorLike = {
    statusCode?: number;
    status?: number;
    message: string;
    errors?: unknown;
};

export function isHttpError(err: unknown): err is HttpErrorLike {
    if (typeof err !== 'object' || err === null) return false;
    const candidate = err as HttpErrorLike;
    return (
        (typeof candidate.statusCode === 'number' || typeof candidate.status === 'number') &&
        typeof candidate.message === 'string'
    );
}
