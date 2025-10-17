// src/services/dndApiService.ts
import type { ApiRace, ApiClass, ApiListItem, ApiSubrace, ApiBackground, ApiClassLevel, ApiSpell, ApiTrait, InventoryItem, ApiCondition, ApiFeature, ApiSubclass, Feat } from '../types';
import { apiClient } from './apiClient';

// --- Funções Principais (agora chamam nosso backend, que já tem a lógica de cache e homebrew) ---

export const getRaces = () => apiClient('/dnds/races') as Promise<{ results: ApiListItem[] }>;
export const getClasses = () => apiClient('/dnds/classes') as Promise<{ results: ApiListItem[] }>;
export const getAlignments = () => apiClient('/dnds/alignments') as Promise<{ results: ApiListItem[] }>;
export const getSkills = () => apiClient('/dnds/skills') as Promise<{ results: ApiListItem[] }>;
export const getLanguages = () => apiClient('/dnds/languages') as Promise<{ results: ApiListItem[] }>;
export const getBackgrounds = () => apiClient('/dnds/backgrounds') as Promise<{ count: number, results: ApiListItem[] }>;
export const getFeats = () => apiClient('/dnds/feats') as Promise<{ results: ApiListItem[] }>;
export const getTraits = () => apiClient('/dnds/traits') as Promise<{ results: ApiListItem[] }>;
export const getMagicSchools = () => apiClient('/dnds/magic-schools') as Promise<{ results: ApiListItem[] }>;
export const getDamageTypes = () => apiClient('/dnds/damage-types') as Promise<{ results: ApiListItem[] }>;
export const getEquipment = () => apiClient('/dnds/equipment') as Promise<{ results: ApiListItem[] }>;
export const getEquipmentCategories = () => apiClient('/dnds/equipment-categories') as Promise<{ results: ApiListItem[] }>;
export const getConditions = () => apiClient('/dnds/conditions') as Promise<{ results: ApiListItem[] }>;


export const getRaceDetails = (index: string) => apiClient<ApiRace>(`/dnds/races/${index}`);
export const getSubraceDetails = (index: string) => apiClient<ApiSubrace>(`/dnds/subraces/${index}`);
export const getClassDetails = (index: string) => apiClient<ApiClass>(`/dnds/classes/${index}`);
export const getSubclassDetails = (index: string) => apiClient<ApiSubclass>(`/dnds/subclasses/${index}`);
export const getBackgroundDetails = (index: string) => apiClient<ApiBackground>(`/dnds/backgrounds/${index}`);

export const getClassLevels = (index: string) => apiClient<ApiClassLevel[]>(`/dnds/classes/${index}/levels`);
export const getSubclassLevels = (index: string) => apiClient<ApiClassLevel[]>(`/dnds/subclasses/${index}/levels`);
export const getSpellsForClass = (index: string) => apiClient<{ results: ApiListItem[] }>(`/dnds/classes/${index}/spells`);
export const getEquipmentForCategory = (index: string) => apiClient<{ equipment: ApiListItem[] }>(`/dnds/equipment-categories/${index}`);

export const getSpellDetails = (index: string) => apiClient<ApiSpell>(`/dnds/spells/${index}`);
export const getTraitDetails = (index: string) => apiClient<ApiTrait>(`/dnds/traits/${index}`);
export const getFeatDetails = (index: string) => apiClient<Feat>(`/dnds/feats/${index}`);
export const getConditionDetails = (index: string) => apiClient<ApiCondition>(`/dnds/conditions/${index}`);
export const getFeatureDetails = (index: string) => apiClient<ApiFeature>(`/dnds/features/${index}`);
export const getEquipmentDetails = (index: string) => apiClient<InventoryItem>(`/dnds/equipment/${index}`);
