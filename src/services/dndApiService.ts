// src/services/dndApiService.ts
import type { ApiRace, ApiClass, ApiListItem, ApiSubrace, ApiBackground, ApiClassLevel, ApiSpell, ApiTrait, InventoryItem, ApiCondition, ApiFeature, ApiSubclass, Feat } from '../types';
import { apiClient } from './apiClient';

/**
 * Função auxiliar para adicionar o sessionId aos parâmetros de consulta se ele existir.
 * Isso permite que o backend sirva conteúdo homebrew específico da sessão quando aplicável.
 */
const apiClientWithSession = (endpoint: string, sessionId?: number | null) => {
    let finalEndpoint = endpoint;
    if (sessionId) {
        const separator = endpoint.includes('?') ? '&' : '?';
        finalEndpoint = `${endpoint}${separator}sessionId=${sessionId}`;
    }
    return apiClient(finalEndpoint);
}


// --- Funções Principais (agora chamam nosso backend, que já tem a lógica de cache e homebrew) ---

export const getRaces = () => apiClientWithSession('/dnds/races') as Promise<{ results: ApiListItem[] }>;
export const getClasses = () => apiClientWithSession('/dnds/classes') as Promise<{ results: ApiListItem[] }>;
export const getAlignments = () => apiClientWithSession('/dnds/alignments') as Promise<{ results: ApiListItem[] }>;
export const getSkills = () => apiClientWithSession('/dnds/skills') as Promise<{ results: ApiListItem[] }>;
export const getLanguages = () => apiClientWithSession('/dnds/languages') as Promise<{ results: ApiListItem[] }>;
export const getBackgrounds = () => apiClientWithSession('/dnds/backgrounds') as Promise<{ count: number, results: ApiListItem[] }>;
export const getFeats = () => apiClientWithSession('/dnds/feats') as Promise<{ results: ApiListItem[] }>;
export const getTraits = () => apiClientWithSession('/dnds/traits') as Promise<{ results: ApiListItem[] }>;
export const getMagicSchools = () => apiClientWithSession('/dnds/magic-schools') as Promise<{ results: ApiListItem[] }>;
export const getDamageTypes = () => apiClientWithSession('/dnds/damage-types') as Promise<{ results: ApiListItem[] }>;
export const getEquipment = () => apiClientWithSession('/dnds/equipment') as Promise<{ results: ApiListItem[] }>;
export const getEquipmentCategories = () => apiClientWithSession('/dnds/equipment-categories') as Promise<{ results: ApiListItem[] }>;
export const getConditions = () => apiClientWithSession('/dnds/conditions') as Promise<{ results: ApiListItem[] }>;


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
