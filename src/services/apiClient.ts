// src/services/apiClient.ts

// A URL base da API é lida das variáveis de ambiente do Next.js
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-5e.edsin-server.space/api';

/**
 * Obtém os headers de autenticação, incluindo o token JWT do localStorage.
 * Lança um erro se o token não for encontrado, garantindo que as chamadas não prossigam sem autenticação.
 */
const getAuthHeaders = (): HeadersInit => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
        throw new Error("Token de autenticação não encontrado. Por favor, faça o login novamente.");
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

/**
 * Um wrapper para a API fetch que centraliza a lógica de chamada ao nosso backend.
 * Ele automaticamente adiciona a URL base, os headers de autenticação e trata as respostas de erro.
 * @param endpoint O endpoint da API a ser chamado (ex: '/auth/login').
 * @param options As opções de configuração para a chamada fetch (método, corpo, etc.).
 * @returns A resposta JSON da API.
 * @throws Lança um erro com a mensagem do servidor se a resposta não for 'ok'.
 */
export const apiClient = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
    const { headers, ...customOptions } = options;

    const requestOptions: RequestInit = {
        // Usa headers de autenticação para todas as rotas, exceto as de login/registro
        headers: (endpoint.startsWith('/auth/'))
            ? { 'Content-Type': 'application/json', ...headers }
            : { ...getAuthHeaders(), ...headers },
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
        return { success: true } as T;
    }

    return await response.json() as T;
};
