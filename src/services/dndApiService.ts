// src/services/dndApiService.ts
import type { ApiRace, ApiClass, ApiListItem, ApiSubrace, ApiBackground, ApiClassLevel, ApiSpell, ApiTrait, InventoryItem, ApiCondition, ApiFeature, ApiSubclass, Feat } from '../types';
import { apiClient } from './apiClient';

// --- Funções de Lista (agora chamam o novo endpoint unificado do backend) ---

export const getRaces = () => apiClient<{ results: ApiListItem[] }>('/data/races');
export const getClasses = () => apiClient<{ results: ApiListItem[] }>('/data/classes');
export const getBackgrounds = () => apiClient<{ results: ApiListItem[] }>('/data/backgrounds');
export const getAlignments = () => apiClient<{ results: ApiListItem[] }>('/data/alignments');
export const getSkills = () => apiClient<{ results: ApiListItem[] }>('/data/skills');
export const getLanguages = () => apiClient<{ results: ApiListItem[] }>('/data/languages');
export const getFeats = () => apiClient<{ results: ApiListItem[] }>('/data/feats');
export const getTraits = () => apiClient<{ results: ApiListItem[] }>('/data/traits');
export const getMagicSchools = () => apiClient<{ results: ApiListItem[] }>('/data/magic-schools');
export const getDamageTypes = () => apiClient<{ results: ApiListItem[] }>('/data/damage-types');
export const getEquipmentCategories = () => apiClient<{ results: ApiListItem[] }>('/data/equipment-categories');
export const getConditions = () => apiClient<{ results: ApiListItem[] }>('/data/conditions');
export const getEquipment = () => apiClient<InventoryItem[]>('/data/equipment');

// --- Funções de Detalhes (também usam o endpoint unificado) ---

export const getRaceDetails = (index: string) => apiClient<ApiRace>(`/data/races/${index}`);
export const getSubraceDetails = (index: string) => apiClient<ApiSubrace>(`/data/subraces/${index}`);
export const getClassDetails = (index: string) => apiClient<ApiClass>(`/data/classes/${index}`);
export const getSubclassDetails = (index: string) => apiClient<ApiSubclass>(`/data/subclasses/${index}`);
export const getBackgroundDetails = (index: string) => apiClient<ApiBackground>(`/data/backgrounds/${index}`);
export const getClassLevels = (index: string) => apiClient<ApiClassLevel[]>(`/data/classes/${index}/levels`);
export const getSubclassLevels = (index: string) => apiClient<ApiClassLevel[]>(`/data/subclasses/${index}/levels`);
export const getSpellsForClass = (index: string) => apiClient<{ results: ApiListItem[] }>(`/data/classes/${index}/spells`);
export const getSpellDetails = (index: string) => apiClient<ApiSpell>(`/data/spells/${index}`);
export const getTraitDetails = (index: string) => apiClient<ApiTrait>(`/data/traits/${index}`);
export const getFeatDetails = (index: string) => apiClient<Feat>(`/data/feats/${index}`);
export const getConditionDetails = (index: string) => apiClient<ApiCondition>(`/data/conditions/${index}`);
export const getFeatureDetails = (index: string) => apiClient<ApiFeature>(`/data/features/${index}`);
export const getEquipmentDetails = (index: string) => apiClient<InventoryItem>(`/data/equipment/${index}`);
export const getSkillDetails = (index: string) => apiClient<any>(`/data/skills/${index}`);
export const getEquipmentCategoryDetails = (index: string) => apiClient<{ equipment: ApiListItem[] }>(`/data/equipment-categories/${index}`);
