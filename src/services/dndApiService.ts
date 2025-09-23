// services/dndApiService.ts
import type { ApiRace, ApiClass, ApiListItem, ApiSubrace, ApiBackground, ApiClassLevel, ApiSpell, ApiTrait, InventoryItem, ApiCondition, ApiFeature, ApiSubclass } from '../types';

const API_BASE = 'https://www.dnd5eapi.co/api';

// Simple in-memory cache
const cache = new Map<string, any>();

async function fetchFromApi<T>(endpoint: string): Promise<T | null> {
    if (cache.has(endpoint)) {
        return cache.get(endpoint) as T;
    }
    try {
        const response = await fetch(`${API_BASE}${endpoint}`);
        if (!response.ok) {
            console.error(`API Error: ${response.status} for endpoint ${endpoint}`);
            return null;
        }
        const data = await response.json();
        cache.set(endpoint, data);
        return data as T;
    } catch (error) {
        console.error(`Fetch Error for endpoint ${endpoint}:`, error);
        return null;
    }
}

export const getRaces = () => fetchFromApi<{ results: ApiListItem[] }>('/races');
export const getClasses = () => fetchFromApi<{ results: ApiListItem[] }>('/classes');
export const getAlignments = () => fetchFromApi<{ results: ApiListItem[] }>('/alignments');
export const getSkills = () => fetchFromApi<{ results: ApiListItem[] }>('/skills');
export const getLanguages = () => fetchFromApi<{ results: ApiListItem[] }>('/languages');
export const getBackgrounds = () => fetchFromApi<{ results: ApiListItem[] }>('/backgrounds');

export const getRaceDetails = (index: string) => fetchFromApi<ApiRace>(`/races/${index}`);
export const getSubraceDetails = (index: string) => fetchFromApi<ApiSubrace>(`/subraces/${index}`);
export const getClassDetails = (index: string) => fetchFromApi<ApiClass>(`/classes/${index}`);
export const getSubclassDetails = (index: string) => fetchFromApi<ApiSubclass>(`/subclasses/${index}`);
export const getBackgroundDetails = (index: string) => fetchFromApi<ApiBackground>(`/backgrounds/${index}`);
export const getClassLevels = (index: string) => fetchFromApi<ApiClassLevel[]>(`/classes/${index}/levels`);
export const getSubclassLevels = (index: string) => fetchFromApi<ApiClassLevel[]>(`/subclasses/${index}/levels`);
export const getSpellsForClass = (index: string) => fetchFromApi<{ results: ApiListItem[] }>(`/classes/${index}/spells`);
export const getEquipmentForCategory = (index: string) => fetchFromApi<{ equipment: ApiListItem[] }>(`/equipment-categories/${index}`);

export const getSpellDetails = (index: string) => fetchFromApi<ApiSpell>(`/spells/${index}`);
export const getTraitDetails = (index: string) => fetchFromApi<ApiTrait>(`/traits/${index}`);
export const getEquipmentDetails = (index: string) => fetchFromApi<Partial<InventoryItem>>(`/equipment/${index}`);
export const getConditionDetails = (index: string) => fetchFromApi<ApiCondition>(`/conditions/${index}`);
export const getFeatureDetails = (index: string) => fetchFromApi<ApiFeature>(`/features/${index}`);
export const getClassLevelDetails = (classIndex: string, level: number) => fetchFromApi<ApiClassLevel>(`/classes/${classIndex}/levels/${level}`);

// Constants for game logic
export const XP_THRESHOLDS: Record<number, number> = {
    1: 300, 2: 900, 3: 2700, 4: 6500, 5: 14000, 6: 23000, 7: 34000, 8: 48000, 9: 64000,
    10: 85000, 11: 100000, 12: 120000, 13: 140000, 14: 165000, 15: 195000, 16: 225000,
    17: 265000, 18: 305000, 19: 355000, 20: Infinity
};

export const PROFICIENCY_BONUS: Record<number, number> = {
    1: 2, 2: 2, 3: 2, 4: 2, 5: 3, 6: 3, 7: 3, 8: 3, 9: 4, 10: 4, 11: 4, 12: 4,
    13: 5, 14: 5, 15: 5, 16: 5, 17: 6, 18: 6, 19: 6, 20: 6
};
