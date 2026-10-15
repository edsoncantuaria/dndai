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

export const updateRegion = async (
  regionId: number,
  payload: Partial<{
    name: string;
    slug: string;
    type: RegionDTO['type'];
    parentSlug?: string | null;
    summary?: string | null;
    description?: string | null;
    metadata?: Record<string, any>;
    isSpawnPool?: boolean;
  }>
) => {
  return apiClient<RegionDTO>(`/regions/${regionId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
};

export interface CreateRegionLinkInput {
  fromRegionSlug: string;
  toRegionSlug: string;
  travelMode: RegionTravelMode;
  travelTimeMinutes?: number;
  difficulty?: string;
  isLocked?: boolean;
  notes?: string;
  metadata?: Record<string, any>;
}

export const createRegionLink = async (payload: CreateRegionLinkInput) => {
  return apiClient('/regions/links', {
    method: 'POST',
    body: JSON.stringify(payload),
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

export interface RegionGraphRegion {
  slug: string;
  name: string;
  type: 'world' | 'city' | 'dungeon' | 'wild' | 'instance';
  parentSlug?: string | null;
  summary?: string;
  description?: string;
  metadata?: Record<string, any>;
  isSpawnPool?: boolean;
}

export interface RegionGraphLink {
  fromSlug: string;
  toSlug: string;
  travelMode?: RegionTravelMode;
  travelTimeMinutes?: number;
  difficulty?: string;
  isLocked?: boolean;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface RegionGraphPoi {
  regionSlug: string;
  name: string;
  slug: string;
  type?: string;
  summary?: string;
  description?: string;
  metadata?: Record<string, any>;
  isLocked?: boolean;
  allowAiExpansion?: boolean;
}

export interface RegionGraphPayload {
  regions: RegionGraphRegion[];
  links: RegionGraphLink[];
  pois: RegionGraphPoi[];
}

export interface RegionBackgroundResponse {
  key: string;
  url: string | null;
  contentType?: string;
  originalName?: string | null;
  size?: number;
  updatedAt: string;
}

export const exportRegionGraphPayload = async (): Promise<RegionGraphPayload> => {
  return apiClient<RegionGraphPayload>('/regions/export', { method: 'GET' });
};

export const importRegionGraphPayload = async (
  payload: RegionGraphPayload & { clearExisting?: boolean }
) => {
  return apiClient('/regions/import', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const POI_TYPES = [
  'landmark',
  'dungeon',
  'shop',
  'story',
  'wild',
  'instance',
  'misc',
] as const;
export type PoiType = (typeof POI_TYPES)[number];

export interface CreatePoiInput {
  regionSlug: string;
  name: string;
  slug: string;
  type: PoiType;
  summary?: string;
  description?: string;
  metadata?: Record<string, any>;
  isLocked?: boolean;
  allowAiExpansion?: boolean;
}

export interface UpdatePoiInput extends Partial<CreatePoiInput> {
  id: number;
}

export const createPoi = async (payload: CreatePoiInput) => {
  return apiClient('/regions/pois', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const updatePoi = async (payload: UpdatePoiInput) => {
  return apiClient(`/regions/pois/${payload.id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
};

export const deletePoi = async (id: number) => {
  return apiClient(`/regions/pois/${id}`, {
    method: 'DELETE',
  });
};

export const uploadRegionBackground = async (
  regionSlug: string,
  payload: { dataUrl: string; fileName?: string }
) => {
  return apiClient<RegionBackgroundResponse>(`/regions/${regionSlug}/background`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const deleteRegionBackground = async (regionSlug: string) => {
  return apiClient(`/regions/${regionSlug}/background`, {
    method: 'DELETE',
  });
};

export interface RegionSnapshotDTO {
  id: number;
  label: string;
  authorId?: number | null;
  createdAt: string;
}

export const listRegionSnapshots = async (): Promise<RegionSnapshotDTO[]> => {
  const response = await apiClient<{ snapshots: RegionSnapshotDTO[] }>('/regions/snapshots', {
    method: 'GET',
  });
  return response.snapshots ?? [];
};

export const createRegionSnapshot = async (label?: string) => {
  return apiClient<RegionSnapshotDTO>('/regions/snapshots', {
    method: 'POST',
    body: JSON.stringify(label?.trim() ? { label } : {}),
  });
};

export const restoreRegionSnapshot = async (snapshotId: number) => {
  return apiClient(`/regions/snapshots/${snapshotId}/restore`, {
    method: 'POST',
  });
};

export const deleteRegionSnapshot = async (snapshotId: number) => {
  return apiClient(`/regions/snapshots/${snapshotId}`, {
    method: 'DELETE',
  });
};

export interface PendingPoiDTO extends RegionPoiDTO {
  regionSlug: string;
  regionName?: string;
}

export const listPendingPois = async (): Promise<PendingPoiDTO[]> => {
  const response = await apiClient<{ pois: PendingPoiDTO[] }>('/regions/pois/pending', {
    method: 'GET',
  });
  return response.pois ?? [];
};

export const approvePendingPoi = async (poiId: number) => {
  return apiClient(`/regions/pois/${poiId}/approve`, {
    method: 'POST',
  });
};

export const rejectPendingPoi = async (poiId: number) => {
  return apiClient(`/regions/pois/${poiId}/reject`, {
    method: 'POST',
  });
};
