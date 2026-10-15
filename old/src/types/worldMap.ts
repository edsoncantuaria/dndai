import type { RegionDTO, RegionPoiDTO, RegionTravelMode } from '@/services/regionClient';

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
    metadata?: Record<string, unknown>;
    discovered: boolean;
    reachable?: boolean;
    fromCurrent?: boolean;
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
