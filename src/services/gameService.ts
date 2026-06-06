// src/services/gameService.ts — facade PENAI v2 (preferir penaiApi para gameplay novo)
import { apiClient } from './apiClient';
import type { NewCharacterInfo, SessaoIA, Character } from '@/types';
export type {
    SessionFactsResponse,
    SessionReplayResponse,
    WorldMapRegion,
    WorldMapMarker,
    WorldMapLink,
    WorldMapSnapshot,
} from '@/types/worldMap';
import type { SessionFactsResponse, SessionReplayResponse, WorldMapSnapshot } from '@/types/worldMap';

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

export const updateVaultCharacter = async (characterId: string | number, characterData: NewCharacterInfo) => {
    return apiClient<{ message: string; character: Character }>(`/v2/characters/${characterId}`, {
        method: 'PUT',
        body: JSON.stringify(characterData),
    });
};

export const deleteCharacterById = async (characterId: string | number) => {
     return apiClient<{ message: string }>(`/v2/characters/${characterId}`, {
        method: 'DELETE',
    });
};


// --- Session Management (PENAI v2 exclusivo) ---

export const createGameSession = async (
    nome: string,
    _characterId: number,
    _options?: { forceNew?: boolean; clientInstanceId?: string },
) => {
    const { createPenaiSession } = await import('./penaiApi');
    const session = await createPenaiSession(nome);
    return { sessao: session as unknown as SessaoIA, isNew: true };
};

export const getGameSessions = async (): Promise<SessaoIA[]> => {
    const { fetchPenaiSessions } = await import('./penaiApi');
    const { penaiSessionToSessaoIA } = await import('@/lib/penaiCharacterAdapter');
    const res = await fetchPenaiSessions();
    return (res.sessions ?? []).map(row => penaiSessionToSessaoIA(row));
};

export const getSessionDetails = async (sessionId: number): Promise<SessaoIA> => {
    const { fetchPenaiSession } = await import('./penaiApi');
    const { penaiSessionToSessaoIA } = await import('@/lib/penaiCharacterAdapter');
    const row = await fetchPenaiSession(sessionId);
    return penaiSessionToSessaoIA(row);
};

/** @deprecated Gameplay usa PENAI v2 — delega para penaiApi. */
export const getSessionFacts = async (sessionId: number): Promise<SessionFactsResponse> => {
    const { fetchPenaiSessionSummary, fetchSessionCampaignState } = await import('./penaiApi');
    const [summary, campaign] = await Promise.all([
        fetchPenaiSessionSummary(sessionId),
        fetchSessionCampaignState(sessionId).catch(() => null),
    ]);
    return {
        storySummary: summary.nome,
        timelineFacts: summary.recentFacts.map(f => f.summary).join('\n') || null,
        recentEvents: summary.recentFacts.map((f, idx) => ({
            turn: Math.max(0, summary.actionSequence - idx),
            timestamp: f.at,
            action: f.category,
            summary: f.subject ? `${f.summary}` : f.summary,
        })),
        activeNPCs: [],
        activeQuests: (campaign?.activeQuests ?? []).map(q => ({
            id: q.questSlug,
            title: q.title,
            status: q.status,
            source: 'penai',
            summary: `Estágio ${q.stage}`,
        })),
        atomicFacts: summary.recentFacts.map(f => ({
            id: f.at,
            category: f.category,
            subject: f.subject ?? null,
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
