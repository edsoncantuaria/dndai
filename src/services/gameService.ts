// src/services/gameService.ts
import { apiClient } from './apiClient';
import type { NewCharacterInfo, SessaoIA, Character, CombatState, GameMasterResponse } from "@/types";

// --- Character Management ---

export const getCharacters = async (): Promise<Character[]> => {
    return apiClient<Character[]>('/characters', { method: 'GET' });
};

export const getCharacterById = async (characterId: number): Promise<Character> => {
    return apiClient<Character>(`/characters/${characterId}`, { method: 'GET' });
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

export const createGameSession = async (nome: string, characterId: number, homebrewIds?: string[]) => {
    return apiClient<{ sessao: SessaoIA, isNew: boolean }>('/sessoes', {
        method: 'POST',
        body: JSON.stringify({ nome, characterId, homebrewIds }),
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

export const updateSessionHomebrew = async (sessionId: number, homebrewId: string, action: 'install' | 'uninstall') => {
    return apiClient<{ sessao: SessaoIA, message: string }>(`/sessoes/${sessionId}/homebrew`, {
        method: 'PATCH',
        body: JSON.stringify({ homebrewId, action }),
    });
};


// --- Gameplay Actions ---

export const processPlayerAction = async (
    sessionId: number, 
    prompt: string, 
    apiKey: string, 
    combatState?: CombatState, 
    model?: string,
    useAiHomebrew?: boolean, // Adicionado
): Promise<GameMasterResponse> => {
    return apiClient<GameMasterResponse>(`/narrar/${sessionId}`, {
        method: 'POST',
        body: JSON.stringify({
            prompt,
            apiKey,
            combatState,
            model,
            useAiHomebrew, // Adicionado ao corpo da requisição
        }),
    });
};