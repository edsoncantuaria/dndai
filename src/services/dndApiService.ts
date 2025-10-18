// src/services/dndApiService.ts
import type { ApiRace, ApiClass, ApiListItem, ApiSubrace, ApiBackground, ApiClassLevel, ApiSpell, ApiTrait, InventoryItem, ApiCondition, ApiFeature, ApiSubclass, Feat } from '../types';
import { apiClient } from './apiClient';

// --- Funções de Lista (agora chamam o novo endpoint unificado do backend) ---

// Função auxiliar para simplificar as chamadas de lista
const getResourceList = (resource: string) => {
    return apiClient<{ results: ApiListItem[] }>(`/data/${resource}`);
};

export const getRaces = () => getResourceList('races');
export const getClasses = () => getResourceList('classes');
export const getBackgrounds = () => getResourceList('backgrounds');
export const getAlignments = () => getResourceList('alignments');
export const getSkills = () => getResourceList('skills');
export const getLanguages = () => getResourceList('languages');
export const getFeats = () => getResourceList('feats');
export const getTraits = () => getResourceList('traits');
export const getMagicSchools = () => getResourceList('magic-schools');
export const getDamageTypes = () => getResourceList('damage-types');
export const getEquipmentCategories = () => getResourceList('equipment-categories');
export const getConditions = () => getResourceList('conditions');

// Esta função agora também usa a rota unificada, o backend cuida de cache e unificação.
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
