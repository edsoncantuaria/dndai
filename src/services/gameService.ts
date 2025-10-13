// src/services/gameService.ts
import type { NewCharacterInfo, CombatState, SessaoIA, Character } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8071/api';

const handleFetchError = (error: any, context: string): never => {
    console.error(`Erro em ${context}:`, error);
    if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão e se o servidor está online.');
    }
    throw error;
};

const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
        throw new Error("Token de autenticação não encontrado. Por favor, faça login novamente.");
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

// --- Character Management ---

export const getCharacters = async (): Promise<Character[]> => {
    try {
        const response = await fetch(`${API_URL}/characters`, {
            method: 'GET',
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Falha ao buscar os personagens.');
        }
        return await response.json();
    } catch (error) {
        handleFetchError(error, 'getCharacters');
    }
};

export const createNewCharacter = async (characterData: NewCharacterInfo) => {
    try {
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
    } catch (error) {
        handleFetchError(error, 'createNewCharacter');
    }
};

export const deleteCharacterById = async (characterId: number) => {
    try {
        const response = await fetch(`${API_URL}/characters/${characterId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Falha ao deletar o personagem.');
        }
        return await response.json();
    } catch (error) {
        handleFetchError(error, 'deleteCharacterById');
    }
};

// --- Session Management ---

export const createGameSession = async (nome: string, characterId: number) => {
    try {
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
    } catch (error) {
        handleFetchError(error, 'createGameSession');
    }
};

export const getGameSessions = async (): Promise<SessaoIA[]> => {
    try {
        const response = await fetch(`${API_URL}/sessoes`, {
            method: 'GET',
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Falha ao buscar as sessões de jogo.');
        }
        return await response.json();
    } catch (error) {
        handleFetchError(error, 'getGameSessions');
    }
};

export const getSessionDetails = async (sessionId: number): Promise<SessaoIA> => {
    try {
        const response = await fetch(`${API_URL}/sessoes/${sessionId}`, {
            method: 'GET',
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Falha ao buscar os detalhes da sessão.');
        }
        return await response.json();
    } catch (error) {
        handleFetchError(error, 'getSessionDetails');
    }
};

export const deleteSessionById = async (sessionId: number) => {
    try {
        const response = await fetch(`${API_URL}/sessoes/${sessionId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Falha ao deletar a sessão.');
        }
        return await response.json();
    } catch (error) {
        handleFetchError(error, 'deleteSessionById');
    }
};

// --- Gameplay Actions ---

export const processPlayerAction = async (
    sessionId: number,
    prompt: string,
    combatState: CombatState | undefined,
    onChunk: (text: string) => void
): Promise<any> => {
    try {
        const response = await fetch(`${API_URL}/narrar/${sessionId}`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ prompt, combatState, stream: true }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Ocorreu um erro ao se comunicar com o Mestre.');
        }
        
        if (!response.body) {
            throw new Error("A resposta do servidor não continha um corpo para streaming.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            
            // Check for our custom separator
            const parts = buffer.split('\n--END_OF_STREAM--\n');
            if (parts.length > 1) {
                // Process the part before the separator as text chunks
                onChunk(parts[0]);
                // The rest is the final JSON payload
                buffer = parts[1]; 
                break; // Exit the reading loop
            }
        }

        // At this point, the loop has finished.
        // The remaining content in `buffer` should be the final JSON object.
        if (buffer) {
            try {
                return JSON.parse(buffer);
            } catch (e) {
                console.error("Erro ao analisar o JSON final do stream:", e, "Buffer:", buffer);
                throw new Error("A resposta final do mestre estava mal formatada.");
            }
        }
        return null; // Should ideally not be reached if the stream is well-formed

    } catch (error) {
        handleFetchError(error, 'processPlayerAction');
    }
};
