// src/services/regionClient.ts
import { apiClient } from './apiClient';

export type RegionTravelMode = 'walk' | 'mount' | 'airship' | 'portal' | 'ship' | 'teleport';

export interface RegionNeighborDTO {
  id: number;
  direction: 'incoming' | 'outgoing';
  targetRegionId: number;
  targetRegionSlug?: string;
  targetRegionName?: string;
  travelMode: RegionTravelMode;
  travelTimeMinutes: number;
  difficulty?: string | null;
  isLocked: boolean;
  notes?: string | null;
  metadata?: Record<string, any>;
}

export interface RegionPoiDTO {
  id: number;
  slug: string;
  name: string;
  type: string;
  summary?: string | null;
  description?: string | null;
  metadata?: Record<string, any>;
  isLocked: boolean;
  allowAiExpansion: boolean;
}

export interface RegionDTO {
  id: number;
  slug: string;
  name: string;
  summary?: string | null;
  description?: string | null;
  type: 'world' | 'city' | 'dungeon' | 'wild' | 'instance';
  parentRegionId?: number | null;
  parentSlug?: string | null;
  parentName?: string | null;
  metadata?: Record<string, any>;
  isSpawnPool?: boolean;
  pointsOfInterest?: RegionPoiDTO[];
  neighbors?: RegionNeighborDTO[];
}

export interface RegionListResponse {
  regions: RegionDTO[];
}

export const fetchRegions = async (): Promise<RegionDTO[]> => {
  const response = await apiClient<RegionListResponse>('/regions', { method: 'GET' });
  return response.regions ?? [];
};

export const updateRegionSpawnPool = async (regionId: number, isSpawnPool: boolean) => {
  return apiClient<RegionDTO>(`/regions/${regionId}`, {
    method: 'PUT',
    body: JSON.stringify({ isSpawnPool }),
  });
};

export interface RegionAiDraftRequest {
  prompt: string;
  baseRegionSlug?: string;
}

export interface RegionAiDraftResponse {
  region: {
    name: string;
    slug?: string;
    type: string;
    summary?: string;
    metadata?: Record<string, any>;
    parentSlug?: string | null;
  };
  links?: Array<{
    toSlug: string;
    travelMode?: RegionTravelMode;
    travelTimeMinutes?: number;
    difficulty?: string;
    notes?: string;
  }>;
  pointsOfInterest?: Array<{
    name: string;
    slug?: string;
    type?: string;
    summary?: string;
    description?: string;
    metadata?: Record<string, any>;
  }>;
}

export const requestRegionDraft = async (payload: RegionAiDraftRequest) => {
  return apiClient<RegionAiDraftResponse>('/regions/ai/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};
