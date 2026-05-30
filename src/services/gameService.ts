// src/services/gameService.ts
import { apiClient } from './apiClient';
import type { NewCharacterInfo, SessaoIA, Character } from '@/types';
import type { RegionDTO, RegionPoiDTO, RegionTravelMode } from './regionClient';

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
    atomicFacts?: Array<{
        id: string;
        category: string;
        subject?: string | null;
        fact: string;
        regionSlug?: string | null;
    }>;
}

export interface SessionReplayResponse {
    fileName: string;
    markdown: string;
}

export interface WorldMapRegion extends RegionDTO {
    isDiscovered?: boolean;
    isCurrent?: boolean;
    pointsOfInterest?: Array<RegionPoiDTO & { isDiscovered?: boolean }>;
}

export interface WorldMapMarker {
    id: string;
    type: 'player' | 'npc' | 'quest';
    label: string;
    regionSlug: string;
    poiSlug?: string | null;
    status?: string | null;
    description?: string | null;
    relatedNpcId?: string | null;
    questId?: string | null;
    isDiscovered: boolean;
}

export interface WorldMapLink {
    fromSlug: string;
    toSlug: string;
    travelMode: RegionTravelMode;
    travelTimeMinutes?: number;
    difficulty?: string | null;
    isLocked: boolean;
    metadata?: Record<string, any>;
    discovered: boolean;
}

export interface WorldMapSnapshot {
    currentRegionSlug: string | null;
    currentPoiSlug: string | null;
    visitedRegions: string[];
    visitedPois: Array<{ regionSlug: string; poiSlug: string; name?: string | null }>;
    regions: WorldMapRegion[];
    links: WorldMapLink[];
    markers: WorldMapMarker[];
    updatedAt: string;
}

// --- Character Management ---

export const getCharacters = async (): Promise<Character[]> => {
    const res = await apiClient<{ characters: Character[] }>('/v2/characters', { method: 'GET' });
    return res.characters ?? [];
};

export const getCharacterById = async (characterId: string | number): Promise<Character> => {
    const res = await apiClient<{ character: Character }>(`/v2/characters/${characterId}`, { method: 'GET' });
    return res.character;
};

export const createNewCharacter = async (characterData: NewCharacterInfo) => {
     return apiClient<{ character: Character }>('/v2/characters', {
        method: 'POST',
        body: JSON.stringify(characterData),
    });
};

export const deleteCharacterById = async (characterId: string | number) => {
     return apiClient<{ message: string }>(`/v2/characters/${characterId}`, {
        method: 'DELETE',
    });
};


// --- Session Management ---

export const createGameSession = async (
    nome: string,
    characterId: number,
    options?: { forceNew?: boolean; clientInstanceId?: string },
) => {
    return apiClient<{ sessao: SessaoIA, isNew: boolean }>('/sessoes', {
        method: 'POST',
        body: JSON.stringify({
            nome,
            characterId,
            forceNew: options?.forceNew ?? false,
            clientInstanceId: options?.clientInstanceId,
        }),
    });
};

export const getGameSessions = async (): Promise<SessaoIA[]> => {
    return apiClient<SessaoIA[]>('/sessoes', { method: 'GET' });
};

export const getSessionDetails = async (sessionId: number): Promise<SessaoIA> => {
    return apiClient<SessaoIA>(`/sessoes/${sessionId}`, { method: 'GET' });
};

/** @deprecated Gameplay usa PENAI v2 — delega para penaiApi. */
export const getSessionFacts = async (sessionId: number): Promise<SessionFactsResponse> => {
    const { fetchPenaiSessionSummary } = await import('./penaiApi');
    const summary = await fetchPenaiSessionSummary(sessionId);
    return {
        storySummary: summary.nome,
        timelineFacts: summary.recentFacts.map(f => f.summary).join('\n') || null,
        recentEvents: summary.recentFacts.map((f, idx) => ({
            turn: Math.max(0, summary.actionSequence - idx),
            timestamp: f.at,
            action: f.type,
            summary: f.summary,
        })),
        activeNPCs: [],
        activeQuests: [],
        atomicFacts: summary.recentFacts.map(f => ({
            id: f.at,
            category: f.type,
            fact: f.summary,
            regionSlug: summary.currentRegionSlug,
        })),
    };
};

export const getSessionReplay = async (sessionId: number): Promise<SessionReplayResponse> => {
    const { apiClientText } = await import('./apiClient');
    const markdown = await apiClientText(`/v2/sessions/${sessionId}/replay`, { method: 'GET' });
    return { fileName: `penai-replay-${sessionId}.md`, markdown };
};

/** @deprecated Gameplay usa PENAI v2 — delega para penaiApi. */
export const getWorldMapSnapshot = async (sessionId: number): Promise<WorldMapSnapshot> => {
    const { fetchPenaiWorldMap } = await import('./penaiApi');
    return fetchPenaiWorldMap(sessionId);
};

/** @deprecated Gameplay usa PENAI v2 — delega para penaiApi. */
export const deleteSessionById = async (sessionId: number) => {
    const { deletePenaiSession } = await import('./penaiApi');
    await deletePenaiSession(sessionId);
    return { message: 'Sessão removida.' };
};

/** @deprecated Gameplay usa PENAI v2 — delega para penaiApi. */
export const updateSessionHomebrew = async (sessionId: number, homebrewId: string, action: 'install' | 'uninstall') => {
    return apiClient<{ ok: boolean }>(`/v2/sessions/${sessionId}/modules`, {
        method: 'PATCH',
        body: JSON.stringify({ moduleId: homebrewId, action }),
    });
};

export const cloneGameSession = async (sessionId: number) => {
    const sessao = await apiClient<Record<string, unknown>>(`/v2/sessions/${sessionId}/clone`, {
        method: 'POST',
    });
    return { sessao, message: 'Sessão clonada com sucesso!' };
};

export const renameGameSession = async (sessionId: number, newName: string) => {
    const { renamePenaiSession } = await import('./penaiApi');
    const sessao = await renamePenaiSession(sessionId, newName);
    return { sessao, message: 'Sessão renomeada.' };
};


// Gameplay em tempo real usa WebSocket (`processAction`) via `useNewGameState`.
// A rota REST `/narrar` foi descontinuada.
