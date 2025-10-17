// src/services/dndApiService.ts
import type { ApiRace, ApiClass, ApiListItem, ApiSubrace, ApiBackground, ApiClassLevel, ApiSpell, ApiTrait, InventoryItem, ApiCondition, ApiFeature, ApiSubclass, Feat } from '../types';
import { apiClient } from './apiClient';

// --- Funções Principais (agora chamam nosso backend, que já tem a lógica de cache e homebrew) ---

export const getRaces = () => apiClient<{ results: ApiListItem[] }>('/dnds/races');
export const getClasses = () => apiClient<{ results: ApiListItem[] }>('/dnds/classes');
export const getAlignments = () => apiClient<{ results: ApiListItem[] }>('/dnds/alignments');
export const getSkills = () => apiClient<{ results: ApiListItem[] }>('/dnds/skills');
export const getLanguages = () => apiClient<{ results: ApiListItem[] }>('/dnds/languages');
export const getBackgrounds = () => apiClient<{ count: number, results: ApiListItem[] }>('/dnds/backgrounds');
export const getFeats = () => apiClient<{ results: ApiListItem[] }>('/dnds/feats');
export const getTraits = () => apiClient<{ results: ApiListItem[] }>('/dnds/traits');
export const getMagicSchools = () => apiClient<{ results: ApiListItem[] }>('/dnds/magic-schools');
export const getDamageTypes = () => apiClient<{ results: ApiListItem[] }>('/dnds/damage-types');
export const getEquipment = () => apiClient<{ results: ApiListItem[] }>('/dnds/equipment');
export const getEquipmentCategories = () => apiClient<{ results: ApiListItem[] }>('/dnds/equipment-categories');
export const getConditions = () => apiClient<{ results: ApiListItem[] }>('/dnds/conditions');


export const getRaceDetails = (index: string) => apiClient<ApiRace>(`/dnds/races/${index}`);
export const getSubraceDetails = (index: string) => apiClient<ApiSubrace>(`/dnds/subraces/${index}`);
export const getClassDetails = (index: string) => apiClient<ApiClass>(`/dnds/classes/${index}`);
export const getSubclassDetails = (index: string) => apiClient<ApiSubclass>(`/dnds/subclasses/${index}`);
export const getBackgroundDetails = (index: string) => apiClient<ApiBackground>(`/dnds/backgrounds/${index}`);

export const getClassLevels = (index: string) => apiClient<ApiClassLevel[]>(`/dnds/classes/${index}/levels`);
export const getSubclassLevels = (index: string) => apiClient<ApiSubclass[]>(`/dnds/subclasses/${index}/levels`);
export const getSpellsForClass = (index: string) => apiClient<{ results: ApiListItem[] }>(`/dnds/classes/${index}/spells`);
export const getEquipmentForCategory = (index: string) => apiClient<{ equipment: ApiListItem[] }>(`/dnds/equipment-categories/${index}`);

export const getSpellDetails = (index: string) => apiClient<ApiSpell>(`/dnds/spells/${index}`);
export const getTraitDetails = (index: string) => apiClient<ApiTrait>(`/dnds/traits/${index}`);
export const getFeatDetails = (index: string) => apiClient<Feat>(`/dnds/feats/${index}`);
export const getConditionDetails = (index: string) => apiClient<ApiCondition>(`/dnds/conditions/${index}`);
export const getFeatureDetails = (index: string) => apiClient<ApiFeature>(`/dnds/features/${index}`);
export const getEquipmentDetails = (index: string) => apiClient<InventoryItem>(`/dnds/equipment/${index}`);
