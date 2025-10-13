// src/services/gameService.ts
import type { NewCharacterInfo, CombatState, SessaoIA, Character } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8071/api';

const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
        throw new Error("Token de autenticação não encontrado.");
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

// --- Character Management ---

export const getCharacters = async (): Promise<Character[]> => {
    const response = await fetch(`${API_URL}/characters`, {
        method: 'GET',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao buscar os personagens.');
    }
    return await response.json();
};

export const createNewCharacter = async (characterData: NewCharacterInfo) => {
     const response = await fetch(`${API_URL}/characters`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(characterData),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao criar o personagem.');
    }
    return await response.json();
};

export const deleteCharacterById = async (characterId: number) => {
     const response = await fetch(`${API_URL}/characters/${characterId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao deletar o personagem.');
    }
    return await response.json();
};


// --- Session Management ---

export const createGameSession = async (nome: string, characterId: number) => {
    const response = await fetch(`${API_URL}/sessoes`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ nome, characterId }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao criar a sessão de jogo.');
    }
    return await response.json();
};

export const getGameSessions = async (): Promise<SessaoIA[]> => {
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

export const getSessionDetails = async (sessionId: number): Promise<SessaoIA> => {
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

export const deleteSessionById = async (sessionId: number) => {
     const response = await fetch(`${API_URL}/sessoes/${sessionId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao deletar a sessão.');
    }
    return await response.json();
};


// --- Gameplay Actions ---

export const processPlayerAction = async (sessionId: number, prompt: string, combatState?: CombatState) => {
    const response = await fetch(`${API_URL}/narrar/${sessionId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ prompt, combatState }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ocorreu um erro ao se comunicar com o Mestre.');
    }
    return await response.json();
};

export const testAiConnection = async (model: string): Promise<string> => {
    // This function might need to be adjusted or removed if the backend
    // handles the API key securely and doesn't expose a direct test endpoint.
    // For now, we assume it exists for diagnostics.
    try {
        // This is a placeholder endpoint. The backend would need a route like '/system/test-ai'
        const response = await fetch(`${API_URL}/narrar/test`, { 
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ 
                prompt: "Diga olá em uma única palavra.",
                model: model 
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
