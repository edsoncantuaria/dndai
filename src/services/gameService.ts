// src/services/gameService.ts

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8071/api';

const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    if (!token) {
        throw new Error("Token de autenticação não encontrado.");
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

export const testAiConnection = async (model: string): Promise<string> => {
    try {
        const response = await fetch(`${API_URL}/test-ai`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                model: model,
                prompt: "Diga olá em uma única palavra."
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.details || result.message || 'Falha na comunicação com o servidor de IA.');
        }

        return result.response || "A IA respondeu, mas sem conteúdo.";
    } catch (error: any) {
        console.error("Erro ao testar a conexão com a IA:", error);
        throw error;
    }
};

export const createGameSession = async (nome: string, apiKey: string) => {
    const response = await fetch(`${API_URL}/sessoes`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ nome, apiKey }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao criar a sessão de jogo.');
    }
    return await response.json();
};

export const getGameSessions = async () => {
    const response = await fetch(`${API_URL}/sessoes`, {
        method: 'GET',
        headers: getAuthHeaders(),
    });
     if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao buscar as sessões de jogo.');
    }
    return await response.json();
};

export const getSessionDetails = async (sessionId: number) => {
    const response = await fetch(`${API_URL}/sessoes/${sessionId}`, {
        method: 'GET',
        headers: getAuthHeaders(),
    });
     if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao buscar os detalhes da sessão.');
    }
    return await response.json();
};

export const processPlayerAction = async (sessionId: number, prompt: string, apiKey: string) => {
    const response = await fetch(`${API_URL}/narrar/${sessionId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ prompt, apiKey }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ocorreu um erro ao se comunicar com o Mestre.');
    }
    return await response.json();
};
