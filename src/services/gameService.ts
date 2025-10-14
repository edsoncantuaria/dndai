// src/services/gameService.ts
import { apiClient } from './apiClient';
import type { NewCharacterInfo, SessaoIA, Character, CombatState } from "@/types";

// --- Character Management ---

export const getCharacters = async (): Promise<Character[]> => {
    return apiClient<Character[]>('/characters', { method: 'GET' });
};

export const createNewCharacter = async (characterData: NewCharacterInfo) => {
     return apiClient<{ character: Character }>('/characters', {
        method: 'POST',
        body: JSON.stringify(characterData),
    });
};

export const deleteCharacterById = async (characterId: number) => {
     return apiClient<{ message: string }>(`/characters/${characterId}`, {
        method: 'DELETE',
    });
};


// --- Session Management ---

export const createGameSession = async (nome: string, characterId: number) => {
    return apiClient<{ sessao: SessaoIA }>('/sessoes', {
        method: 'POST',
        body: JSON.stringify({ nome, characterId }),
    });
};

export const getGameSessions = async (): Promise<SessaoIA[]> => {
    return apiClient<SessaoIA[]>('/sessoes', { method: 'GET' });
};

export const getSessionDetails = async (sessionId: number): Promise<SessaoIA> => {
    return apiClient<SessaoIA>(`/sessoes/${sessionId}`, { method: 'GET' });
};

export const deleteSessionById = async (sessionId: number) => {
     return apiClient<{ message: string }>(`/sessoes/${sessionId}`, {
        method: 'DELETE',
    });
};


// --- Gameplay Actions ---

export const processPlayerAction = async (sessionId: number, prompt: string, combatState?: CombatState) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://backend-5e.edsin-server.space/api'}/narrar/${sessionId}`, {
        method: 'POST',
        headers: {
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ prompt, combatState }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ocorreu um erro ao se comunicar com o Mestre.');
    }
    // Nota: Para streaming, não podemos usar apiClient diretamente pois ele consome o corpo da resposta.
    // Mantemos o fetch aqui para um futuro sistema de streaming. Por enquanto, parseamos o JSON.
    return response.json();
};
