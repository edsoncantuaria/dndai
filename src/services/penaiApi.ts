import { apiClient } from './apiClient';

export type PenaiTravelPreview = {
    fromRegionSlug: string;
    toRegionSlug: string;
    distanceKm: number;
    baseDurationHours: number;
    durationHours: number;
    travelMode: string;
    travelModeLabel: string;
};

export async function fetchPenaiRegions() {
    return apiClient<{ regions: Array<{ slug: string; displayName: string }> }>(
        '/v2/world/regions',
    );
}

export async function fetchTravelPreview(from: string, to: string, mode = 'walk') {
    const params = new URLSearchParams({ from, to, mode });
    return apiClient<{ travel: PenaiTravelPreview }>(`/v2/world/travel/preview?${params}`);
}

export async function createPenaiSession(
    nome: string,
    opts?: { heroName?: string; heroWorldEntityId?: string },
) {
    return apiClient<Record<string, unknown>>('/v2/sessions', {
        method: 'POST',
        body: JSON.stringify({
            nome,
            heroName: opts?.heroName,
            heroWorldEntityId: opts?.heroWorldEntityId,
        }),
    });
}

export async function clonePenaiSession(sessionId: number) {
    return apiClient<Record<string, unknown>>(`/v2/sessions/${sessionId}/clone`, {
        method: 'POST',
    });
}

export async function fetchPenaiSession(sessionId: number) {
    return apiClient<Record<string, unknown>>(`/v2/sessions/${sessionId}`);
}

export async function fetchPenaiSessions() {
    return apiClient<{ sessions: Array<Record<string, unknown>> }>('/v2/sessions');
}

export async function fetchPenaiMechanical(sessionId: number) {
    return apiClient<Record<string, unknown>>(`/v2/sessions/${sessionId}/mechanical`);
}

export async function fetchSessionWorldEvents(sessionId: number, limit = 40) {
    return apiClient<{
        events: Array<{ id: string; type: string; payload: Record<string, unknown>; createdAt: string }>;
    }>(`/v2/world/sessions/${sessionId}/events?limit=${limit}`);
}

export type PenaiSessionSummary = {
    sessionId: number;
    nome: string;
    currentRegionSlug: string | null;
    currentRegionName: string | null;
    worldState: {
        timeOfDay: string;
        weather: string;
        currentRegion: string | null;
        location: string | null;
        gameClock: { day: number; hour: number; weather: string };
    };
    gameClock: { day: number; hour: number; weather: string };
    recentFacts: Array<{ type: string; summary: string; at: string }>;
    actionSequence: number;
};

export type PenaiSessionCampaign = {
    sessionId: number;
    regionSlug: string | null;
    regionState: {
        fear: number;
        prosperity: number;
        crime: number;
        resources?: Record<string, number>;
    } | null;
    activeQuests: Array<{
        questSlug: string;
        title: string;
        stage: number;
        status: string;
    }>;
    heroReputation: Array<{ targetSlug: string; score: number }>;
    knowledgeCount: number;
    knowledgeSnippets: string[];
    gameClock: { day: number; hour: number; weather: string };
    lastPulseAt: string | null;
    campaignDigest: { questCount: number; regionFear: number };
};

export async function fetchSessionCampaignState(sessionId: number) {
    return apiClient<PenaiSessionCampaign>(`/v2/sessions/${sessionId}/campaign`);
}

export async function fetchPenaiSessionSummary(sessionId: number) {
    return apiClient<PenaiSessionSummary>(`/v2/sessions/${sessionId}/summary`);
}

export async function fetchPenaiWorldMap(sessionId: number) {
    return apiClient<import('./gameService').WorldMapSnapshot>(`/v2/sessions/${sessionId}/world-map`);
}

export async function deletePenaiSession(sessionId: number) {
    return apiClient<{ ok: boolean }>(`/v2/sessions/${sessionId}`, { method: 'DELETE' });
}

export async function renamePenaiSession(sessionId: number, nome: string) {
    return apiClient<Record<string, unknown>>(`/v2/sessions/${sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ nome }),
    });
}
