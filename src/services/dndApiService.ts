// src/services/dndApiService.ts
import type { ApiRace, ApiClass, ApiListItem, ApiSubrace, ApiBackground, ApiClassLevel, ApiSpell, ApiTrait, InventoryItem, ApiCondition, ApiFeature, ApiSubclass, Feat } from '../types';
import { apiClient } from './apiClient';
import { HomebrewContent } from './homebrewService';


// --- Funções Principais (agora chamam nosso backend, que já tem a lógica de cache e homebrew) ---

export const getRaces = () => apiClient('/dnds/races', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }}) as Promise<{ results: ApiListItem[] }>;
export const getClasses = () => apiClient('/dnds/classes', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }}) as Promise<{ results: ApiListItem[] }>;
export const getAlignments = () => apiClient('/dnds/alignments', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }}) as Promise<{ results: ApiListItem[] }>;
export const getSkills = () => apiClient('/dnds/skills', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }}) as Promise<{ results: ApiListItem[] }>;
export const getLanguages = () => apiClient('/dnds/languages', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }}) as Promise<{ results: ApiListItem[] }>;
export const getBackgrounds = () => apiClient('/dnds/backgrounds', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }}) as Promise<{ count: number, results: ApiListItem[] }>;
export const getFeats = () => apiClient('/dnds/feats', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }}) as Promise<{ results: ApiListItem[] }>;
export const getTraits = () => apiClient('/dnds/traits', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }}) as Promise<{ results: ApiListItem[] }>;
export const getMagicSchools = () => apiClient('/dnds/magic-schools', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }}) as Promise<{ results: ApiListItem[] }>;
export const getDamageTypes = () => apiClient('/dnds/damage-types', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }}) as Promise<{ results: ApiListItem[] }>;
export const getEquipment = () => apiClient('/dnds/equipment', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }}) as Promise<{ results: ApiListItem[] }>;
export const getEquipmentCategories = () => apiClient('/dnds/equipment-categories', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }}) as Promise<{ results: ApiListItem[] }>;
export const getConditions = () => apiClient('/dnds/conditions', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }}) as Promise<{ results: ApiListItem[] }>;


export const getRaceDetails = (index: string) => apiClient<ApiRace>(`/dnds/races/${index}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
export const getSubraceDetails = (index: string) => apiClient<ApiSubrace>(`/dnds/subraces/${index}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
export const getClassDetails = (index: string) => apiClient<ApiClass>(`/dnds/classes/${index}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
export const getSubclassDetails = (index: string) => apiClient<ApiSubclass>(`/dnds/subclasses/${index}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
export const getBackgroundDetails = (index: string) => apiClient<ApiBackground>(`/dnds/backgrounds/${index}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});

export const getClassLevels = (index: string) => apiClient<ApiClassLevel[]>(`/dnds/classes/${index}/levels`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
export const getSubclassLevels = (index: string) => apiClient<ApiSubclass[]>(`/dnds/subclasses/${index}/levels`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
export const getSpellsForClass = (index: string) => apiClient<{ results: ApiListItem[] }>(`/dnds/classes/${index}/spells`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
export const getEquipmentForCategory = (index: string) => apiClient<{ equipment: ApiListItem[] }>(`/dnds/equipment-categories/${index}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});

export const getSpellDetails = (index: string) => apiClient<ApiSpell>(`/dnds/spells/${index}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
export const getTraitDetails = (index: string) => apiClient<ApiTrait>(`/dnds/traits/${index}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
export const getFeatDetails = (index: string) => apiClient<Feat>(`/dnds/feats/${index}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
export const getConditionDetails = (index: string) => apiClient<ApiCondition>(`/dnds/conditions/${index}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
export const getFeatureDetails = (index: string) => apiClient<ApiFeature>(`/dnds/features/${index}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
export const getEquipmentDetails = (index: string) => apiClient<InventoryItem>(`/dnds/equipment/${index}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});

// Adicionado para listar conteúdo homebrew
export const listHomebrewContent = (scope: 'public' | 'mine', type?: HomebrewContent['type'], page: number = 1, limit: number = 100): Promise<HomebrewContent[]> => {
    const params = new URLSearchParams({ scope, page: String(page), limit: String(limit) });
    if (type) {
        params.append('type', type);
    }
    const endpoint = `/homebrew?${params.toString()}`;
    return apiClient<HomebrewContent[]>(endpoint);
};
