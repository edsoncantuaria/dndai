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

export type PenaiWorldBootstrapStepId =
    | 'region'
    | 'factions'
    | 'npcs'
    | 'quests'
    | 'economy'
    | 'simulation'
    | 'pulse';

export type PenaiWorldBootstrapState = {
    status: 'pending' | 'running' | 'ready' | 'failed';
    step: PenaiWorldBootstrapStepId | null;
    steps: Record<PenaiWorldBootstrapStepId, 'pending' | 'running' | 'done' | 'failed'>;
    startedAt?: string;
    finishedAt?: string;
    error?: string;
};

export const WORLD_BOOTSTRAP_STEP_LABELS: Record<PenaiWorldBootstrapStepId, string> = {
    region: 'Preparando região',
    factions: 'Gerando facções',
    npcs: 'Gerando NPCs',
    quests: 'Gerando missões',
    economy: 'Gerando economia',
    simulation: 'Simulando o mundo',
    pulse: 'Ativando pulso do mundo',
};

export type PenaiSessionUiState = {
    sessionId: number;
    actionOptions: Array<{
        text: string;
        action: string;
        skill?: string;
        needsRoll?: boolean;
        dc?: number;
    }>;
    worldPulse: { headline: string | null; events: string[]; updatedAt: string } | null;
    worldBootstrap: PenaiWorldBootstrapState;
    memoryValidation?: {
        ok: boolean;
        sessionMemoryCount: number;
        npcStateCount: number;
        issues: string[];
    } | null;
};

export async function fetchPenaiSessionUiState(sessionId: number) {
    return apiClient<PenaiSessionUiState>(`/v2/sessions/${sessionId}/ui-state`);
}

export type PenaiWorldBootstrapRunResponse = PenaiSessionUiState & {
    async?: boolean;
    sync?: boolean;
    workflowId?: string;
};

export async function runPenaiWorldBootstrap(sessionId: number) {
    return apiClient<PenaiWorldBootstrapRunResponse>(`/v2/sessions/${sessionId}/world-bootstrap`, {
        method: 'POST',
    });
}

export type PenaiStoryFeedEntry = {
    id?: string;
    timestamp: string;
    content: string;
    tone?: string;
    kind?: string;
    consequences?: string[];
};

export type PenaiStoryFeedResponse = {
    entries: PenaiStoryFeedEntry[];
    spawnBriefing: boolean;
    pendingNarration: boolean;
    pendingReason: string | null;
    actionSequence: number;
    actionCursor: number;
};

export async function fetchPenaiStoryFeed(sessionId: number) {
    return apiClient<PenaiStoryFeedResponse>(`/v2/sessions/${sessionId}/story-feed`);
}

export type PenaiHumanizedEvent = {
    id: string;
    type: string;
    category: string;
    subject?: string;
    summary: string;
    at: string;
    importance: number;
};

export async function fetchSessionWorldEvents(sessionId: number, limit = 40) {
    return apiClient<{ events: PenaiHumanizedEvent[]; locale: string }>(
        `/v2/world/sessions/${sessionId}/events?limit=${limit}`,
    );
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
    recentFacts: Array<{
        type: string;
        category: string;
        subject?: string;
        summary: string;
        at: string;
    }>;
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
        regionSlug: string | null;
        regionName: string | null;
        synopsis: string;
        stageLabel: string;
        kind: 'local' | 'travel';
        isHere: boolean;
    }>;
    heroReputation: Array<{ targetSlug: string; score: number }>;
    reputation: {
        region: {
            regionSlug: string;
            displayName: string;
            targetSlug: string;
            score: number;
            tierId: string;
            tierLabel: string;
        } | null;
        factions: Array<{
            factionSlug: string;
            displayName: string;
            archetype: string;
            targetSlug: string;
            score: number;
            tierId: string;
            tierLabel: string;
            discoveredAt: string;
        }>;
    };
    knowledgeCount: number;
    knowledgeSnippets: string[];
    gameClock: { day: number; hour: number; weather: string };
    lastPulseAt: string | null;
    campaignDigest: { questCount: number; regionFear: number };
    shard: {
        id: string;
        regionSlug: string;
        displayName: string;
        version: number;
        politicsState: 'stable' | 'tense' | 'coup_risk';
        politicsLabel: string;
    } | null;
    timelineRecent: Array<{
        eventId: string;
        eventType: string;
        category: string;
        summary: string;
        worldDay: number;
        at: string;
    }>;
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
