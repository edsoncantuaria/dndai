// src/services/dndApiService.ts
import type { ApiRace, ApiClass, ApiListItem, ApiSubrace, ApiBackground, ApiClassLevel, ApiSpell, ApiTrait, InventoryItem, ApiCondition, ApiFeature, ApiSubclass, Feat } from '../types';
import { apiClient } from './apiClient';

// --- Cache para dados estáticos ---
let backgroundsDataCache: ApiBackground[] | null = null;

const getBackgroundsData = async (): Promise<ApiBackground[]> => {
    if (backgroundsDataCache) {
        return backgroundsDataCache;
    }
    const data = await apiClient<{ results: ApiBackground[] }>('/dnds/backgrounds-data');
    backgroundsDataCache = data.results || [];
    return backgroundsDataCache;
};


// --- Funções Principais (agora chamam nosso backend) ---

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
export const getBackgroundDetails = async (index: string): Promise<ApiBackground | null> => {
    // Regex to check if the index is a UUID (for homebrew content)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(index)) {
        const data = await apiClient<any>(`/homebrew/${index}`);
        return data.content as ApiBackground;
    }
    // It's an official background, fetch from our cached local data
    const allBackgrounds = await getBackgroundsData();
    const background = allBackgrounds.find(bg => bg.index === index);
    if (!background) {
        // This is a fallback and might indicate an issue if it's called often
        console.warn(`Background '${index}' not found in local cache, attempting API fallback.`);
        return apiClient<ApiBackground>(`/dnds/backgrounds/${index}`);
    }
    return background;
};

export const getClassLevels = (index: string) => apiClient<ApiClassLevel[]>(`/dnds/classes/${index}/levels`);
export const getSubclassLevels = (index: string) => apiClient<ApiClassLevel[]>(`/dnds/subclasses/${index}/levels`);
export const getSpellsForClass = (index: string) => apiClient<{ results: ApiListItem[] }>(`/dnds/classes/${index}/spells`);
export const getEquipmentForCategory = (index: string) => apiClient<{ equipment: ApiListItem[] }>(`/dnds/equipment-categories/${index}`);

export const getSpellDetails = (index: string) => apiClient<ApiSpell>(`/dnds/spells/${index}`);
export const getTraitDetails = (index: string) => {
    // Regex to check if the index is a UUID (for homebrew content)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (uuidRegex.test(index)) {
        return apiClient<any>(`/homebrew/${index}`).then(data => data.content as ApiTrait);
    }
    return apiClient<ApiTrait>(`/dnds/traits/${index}`);
}
export const getEquipmentDetails = (index: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(index)) {
        return apiClient<any>(`/homebrew/${index}`).then(data => data.content as Partial<InventoryItem>);
    }
    return apiClient<Partial<InventoryItem>>(`/dnds/equipment/${index}`);
}
export const getConditionDetails = (index: string) => apiClient<ApiCondition>(`/dnds/conditions/${index}`);
export const getFeatureDetails = (index: string) => apiClient<ApiFeature>(`/dnds/features/${index}`);
export const getClassLevelDetails = (classIndex: string, level: number) => apiClient<ApiClassLevel>(`/dnds/classes/${classIndex}/levels/${level}`);
export const getFeatDetails = (index: string) => apiClient<Feat>(`/dnds/feats/${index}`);
