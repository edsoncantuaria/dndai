// src/services/dndApiService.ts
import type { ApiRace, ApiClass, ApiListItem, ApiSubrace, ApiBackground, ApiClassLevel, ApiSpell, ApiTrait, InventoryItem, ApiCondition, ApiFeature, ApiSubclass, Feat } from '../types';
import { apiClient } from './apiClient';
import { AppDataSource } from 'backend/src/database/data-source.js';

// --- Funções Principais (agora chamam o novo endpoint unificado do backend) ---

export const getRaces = () => apiClient('/data/races') as Promise<{ results: ApiListItem[] }>;
export const getClasses = () => apiClient('/data/classes') as Promise<{ results: ApiListItem[] }>;
export const getBackgrounds = () => apiClient('/data/backgrounds') as Promise<{ results: ApiListItem[] }>;
export const getAlignments = () => apiClient('/data/alignments') as Promise<{ results: ApiListItem[] }>;
export const getSkills = () => apiClient('/data/skills') as Promise<{ results: ApiListItem[] }>;
export const getLanguages = () => apiClient('/data/languages') as Promise<{ results: ApiListItem[] }>;
export const getFeats = () => apiClient('/data/feats') as Promise<{ results: ApiListItem[] }>;
export const getTraits = () => apiClient('/data/traits') as Promise<{ results: ApiListItem[] }>;
export const getMagicSchools = () => apiClient('/data/magic-schools') as Promise<{ results: ApiListItem[] }>;
export const getDamageTypes = () => apiClient('/data/damage-types') as Promise<{ results: ApiListItem[] }>;
export const getEquipmentCategories = () => apiClient('/data/equipment-categories') as Promise<{ results: ApiListItem[] }>;
export const getConditions = () => apiClient('/data/conditions') as Promise<{ results: ApiListItem[] }>;
export const getEquipment = () => apiClient<InventoryItem[]>('/data/equipment') as Promise<InventoryItem[]>;

// Funções de Detalhes
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
