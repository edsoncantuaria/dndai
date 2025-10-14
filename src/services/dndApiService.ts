// src/services/dndApiService.ts
import type { ApiRace, ApiClass, ApiListItem, ApiSubrace, ApiBackground, ApiClassLevel, ApiSpell, ApiTrait, InventoryItem, ApiCondition, ApiFeature, ApiSubclass, Feat } from '../types';
import { apiClient } from './apiClient';

export const DND_API_BASE = 'https://www.dnd5eapi.co';

// --- Funções Principais (agora chamam nosso backend) ---

export const getRaces = () => apiClient<{ results: ApiListItem[] }>('/dnds/races');
export const getClasses = () => apiClient<{ results: ApiListItem[] }>('/dnds/classes');
export const getAlignments = () => apiClient<{ results: ApiListItem[] }>('/dnds/alignments');
export const getSkills = () => apiClient<{ results: ApiListItem[] }>('/dnds/skills');
export const getLanguages = () => apiClient<{ results: ApiListItem[] }>('/dnds/languages');
export const getBackgrounds = () => apiClient<{ results: ApiListItem[], count: number }>('/dnds/backgrounds');
export const getFeats = () => apiClient<{ results: ApiListItem[] }>('/dnds/feats');

export const getRaceDetails = (index: string) => apiClient<ApiRace>(`/dnds/races/${index}`);
export const getSubraceDetails = (index: string) => apiClient<ApiSubrace>(`/dnds/subraces/${index}`);
export const getClassDetails = (index: string) => apiClient<ApiClass>(`/dnds/classes/${index}`);
export const getSubclassDetails = (index: string) => apiClient<ApiSubclass>(`/dnds/subclasses/${index}`);
export const getBackgroundDetails = (index: string) => {
    // Check if the background is a homebrew one (UUID) vs official (string index)
    if (index.includes('-')) { // Simple check for UUID format
      return apiClient<ApiBackground>(`/homebrew/${index}`);
    }
    return apiClient<ApiBackground>(`/dnds/backgrounds/${index}`);
};

export const getClassLevels = (index: string) => apiClient<ApiClassLevel[]>(`/dnds/classes/${index}/levels`);
export const getSpellsForClass = (index: string) => apiClient<{ results: ApiListItem[] }>(`/dnds/classes/${index}/spells`);
export const getEquipmentForCategory = (index: string) => apiClient<{ equipment: ApiListItem[] }>(`/dnds/equipment-categories/${index}`);

export const getSpellDetails = (index: string) => apiClient<ApiSpell>(`/dnds/spells/${index}`);
export const getTraitDetails = (index: string) => apiClient<ApiTrait>(`/dnds/traits/${index}`);
export const getEquipmentDetails = (index: string) => apiClient<Partial<InventoryItem>>(`/dnds/equipment/${index}`);
export const getConditionDetails = (index: string) => apiClient<ApiCondition>(`/dnds/conditions/${index}`);
export const getFeatureDetails = (index: string) => apiClient<ApiFeature>(`/dnds/features/${index}`);
export const getClassLevelDetails = (classIndex: string, level: number) => apiClient<ApiClassLevel>(`/dnds/classes/${classIndex}/levels/${level}`);
export const getFeatDetails = (index: string) => apiClient<Feat>(`/dnds/feats/${index}`);
