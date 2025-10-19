// src/services/apiClient.ts

// A URL base da API é lida das variáveis de ambiente do Next.js
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-5e.edsin-server.space/';

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

// Rotas que não exigem autenticação
const PUBLIC_ROUTES = ['/auth/login', '/auth/register', '/data/'];

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

    const isPublic = PUBLIC_ROUTES.some(route => endpoint.startsWith(route));
    
    let authHeaders: HeadersInit | null = getAuthHeaders();

    // Se não for uma rota pública e o token não existir, lança um erro.
    if (!isPublic && !authHeaders) {
        throw new Error(`A rota ${endpoint} requer autenticação, mas o token não foi fornecido.`);
    }

    const requestOptions: RequestInit = {
        headers: {
            'Content-Type': 'application/json',
            ...(authHeaders || {}),
            ...customHeaders,
        },
        ...customOptions
    };

    const response = await fetch(`${API_URL}${endpoint}`, requestOptions);

    if (!response.ok) {
        let errorData;
        try {
            // Tenta parsear o corpo do erro como JSON.
            errorData = await response.json();
        } catch (e) {
            // Se falhar, usa o texto de status como fallback.
            throw new Error(response.statusText || 'Ocorreu um erro de rede.');
        }
        // Lança um erro com a mensagem fornecida pelo backend.
        throw new Error(errorData.message || 'Ocorreu um erro desconhecido na comunicação com o servidor.');
    }
    
    // Se a resposta não tiver conteúdo (ex: DELETE com status 204), retorna um objeto de sucesso.
    if (response.status === 204 || response.headers.get('content-length') === '0') {
        return { success: true } as unknown as T;
    }

    return await response.json() as T;
};
