// src/services/gameService.ts
import { apiClient } from './apiClient';
import type { NewCharacterInfo, SessaoIA, Character, CombatState, GameMasterResponse } from "@/types";

export interface SessionFactsResponse {
    storySummary: string | null;
    timelineFacts: string | null;
    recentEvents: Array<{
        turn: number;
        timestamp: string;
        action: string;
        summary: string;
        notes?: string;
    }>;
    activeNPCs: Array<{
        npcId?: string;
        name: string;
        status: string;
        affinity: number;
        description?: string;
        quests: Array<{ id: string; title: string; status: string }>;
    }>;
    activeQuests: Array<{
        id: string;
        title: string;
        status: string;
        source: string;
        summary?: string;
    }>;
}

export interface SessionReplayResponse {
    fileName: string;
    markdown: string;
}

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
    return apiClient<{ sessao: SessaoIA, isNew: boolean }>('/sessoes', {
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

export const getSessionFacts = async (sessionId: number): Promise<SessionFactsResponse> => {
    return apiClient<SessionFactsResponse>(`/sessoes/${sessionId}/facts`, { method: 'GET' });
};

export const getSessionReplay = async (sessionId: number): Promise<SessionReplayResponse> => {
    return apiClient<SessionReplayResponse>(`/sessoes/${sessionId}/replay`, { method: 'GET' });
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
    useAiHomebrew?: boolean,
): Promise<GameMasterResponse> => {
    return apiClient<GameMasterResponse>(`/narrar/${sessionId}`, {
        method: 'POST',
        body: JSON.stringify({
            prompt,
            apiKey,
            combatState,
            model,
            useAiHomebrew,
        }),
    });
};
