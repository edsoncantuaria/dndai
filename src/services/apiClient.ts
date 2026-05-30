// src/services/apiClient.ts

import { getStoredAuthToken } from '@/lib/authToken';

const API_URL =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ||
    'http://localhost:8071/api';

export type ApiFieldErrors = Record<string, string[] | string>;

export class ApiError extends Error {
    status: number;
    details?: ApiFieldErrors;

    constructor(message: string, status: number, details?: ApiFieldErrors) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.details = details;
        Object.setPrototypeOf(this, ApiError.prototype);
    }
}

/**
 * Obtém os headers de autenticação, incluindo o token JWT do localStorage.
 * Retorna null se o token não for encontrado, permitindo que a chamada decida como proceder.
 */
const getAuthHeaders = (): HeadersInit | null => {
    const token = getStoredAuthToken();
    if (!token) {
        return null;
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

// Lista de rotas que não exigem autenticação.
const PUBLIC_ROUTES = [
    '/v2/auth/login',
    '/v2/auth/register',
    '/v2/data',
    '/data',
    '/translations',
    '/health',
    '/v2/health',
    '/v2/world',
];


/**
 * Um wrapper para a API fetch que centraliza a lógica de chamada ao nosso backend.
 * Ele automaticamente adiciona a URL base, os headers de autenticação e trata as respostas de erro.
 * @param endpoint O endpoint da API a ser chamado (ex: '/auth/login').
 * @param options As opções de configuração para a chamada fetch (método, corpo, etc.).
 * @returns A resposta JSON da API.
 * @throws Lança um erro com a mensagem do servidor se a resposta não for 'ok'.
 */
const buildRequestOptions = (endpoint: string, options: RequestInit = {}) => {
    const { headers: customHeaders, ...customOptions } = options;
    const fullUrl = `${API_URL}${endpoint}`;
    const isPublic = PUBLIC_ROUTES.some(route => endpoint.startsWith(route));
    let authHeaders: HeadersInit | null = getAuthHeaders();

    if (!isPublic && !authHeaders) {
        throw new Error(`A rota ${endpoint} requer autenticação, mas o token não foi fornecido.`);
    }

    const requestOptions: RequestInit = {
        headers: {
            ...(authHeaders || {}),
            ...customHeaders,
            'Content-Type': 'application/json',
        },
        ...customOptions
    };

    return { fullUrl, requestOptions };
};

const handleErrorResponse = async (response: Response, endpoint: string) => {
    let errorData: any = null;
    try {
        errorData = await response.json();
    } catch (e) {
        throw new ApiError(`Erro de rede: ${response.status} ${response.statusText}`, response.status);
    }
    const message = typeof errorData?.message === 'string'
        ? errorData.message
        : `Erro desconhecido: ${response.statusText}`;
    const details = errorData?.details || errorData?.errors;
    throw new ApiError(message, response.status, details);
};

export const apiClient = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
    const { headers: customHeaders, ...customOptions } = options;
    const fullUrl = `${API_URL}${endpoint}`;

    const isPublic = PUBLIC_ROUTES.some(route => endpoint.startsWith(route));
    
    let authHeaders: HeadersInit | null = getAuthHeaders();

    if (!isPublic && !authHeaders) {
        throw new Error(`A rota ${endpoint} requer autenticação, mas o token não foi fornecido.`);
    }

    const requestOptions: RequestInit = {
        headers: {
            ...(authHeaders || {}),
            ...customHeaders,
            'Content-Type': 'application/json',
        },
        ...customOptions
    };

    const response = await fetch(fullUrl, requestOptions);

    if (!response.ok) {
        await handleErrorResponse(response, endpoint);
    }
    
    if (response.status === 204 || response.headers.get('content-length') === '0') {
        return { success: true } as unknown as T;
    }

    const responseData = await response.json();
    return responseData as T;
};

export const apiClientText = async (endpoint: string, options: RequestInit = {}): Promise<string> => {
    const { fullUrl, requestOptions } = buildRequestOptions(endpoint, options);
    const response = await fetch(fullUrl, requestOptions);
    if (!response.ok) {
        await handleErrorResponse(response, endpoint);
    }
    return await response.text();
};
