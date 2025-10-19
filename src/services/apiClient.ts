// src/services/apiClient.ts

// A URL da API agora usa a URL de produção como padrão.
const API_URL = 'https://backend-5e.edsin-server.space/api';

/**
 * Obtém os headers de autenticação, incluindo o token JWT do localStorage.
 * Retorna null se o token não for encontrado, permitindo que a chamada decida como proceder.
 */
const getAuthHeaders = (): HeadersInit | null => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
        return null;
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

// Lista de rotas que não exigem autenticação.
const PUBLIC_ROUTES = ['/auth/login', '/auth/register', '/data', '/translations', '/health'];


/**
 * Um wrapper para a API fetch que centraliza a lógica de chamada ao nosso backend.
 * Ele automaticamente adiciona a URL base, os headers de autenticação e trata as respostas de erro.
 * @param endpoint O endpoint da API a ser chamado (ex: '/auth/login').
 * @param options As opções de configuração para a chamada fetch (método, corpo, etc.).
 * @returns A resposta JSON da API.
 * @throws Lança um erro com a mensagem do servidor se a resposta não for 'ok'.
 */
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
        let errorData;
        try {
            errorData = await response.json();
        } catch (e) {
            throw new Error(`Erro de rede: ${response.status} ${response.statusText}`);
        }
        throw new Error(errorData?.message || `Erro desconhecido: ${response.statusText}`);
    }
    
    if (response.status === 204 || response.headers.get('content-length') === '0') {
        return { success: true } as unknown as T;
    }

    const responseData = await response.json();
    return responseData as T;
};
