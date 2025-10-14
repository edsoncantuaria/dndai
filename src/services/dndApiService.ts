// src/services/dndApiService.ts
import type { ApiRace, ApiClass, ApiListItem, ApiSubrace, ApiBackground, ApiClassLevel, ApiSpell, ApiTrait, InventoryItem, ApiCondition, ApiFeature, ApiSubclass, Feat } from '../types';

const API_BASE = '/api/dnd'; // Aponta para o nosso backend agora

async function fetchFromApi<T>(endpoint: string): Promise<T | null> {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`);
        if (!response.ok) {
            console.error(`API Error: ${response.status} for endpoint ${endpoint}`);
            return null;
        }
        // Handle no content responses
        if (response.status === 204) return null;
        return await response.json() as T;
    } catch (error) {
        console.error(`Fetch Error for endpoint ${endpoint}:`, error);
        return null;
    }
}

// --- Funções Principais (agora chamam nosso backend) ---

export const getRaces = () => fetchFromApi<{ results: ApiListItem[] }>('/races');
export const getClasses = () => fetchFromApi<{ results: ApiListItem[] }>('/classes');
export const getAlignments = () => fetchFromApi<{ results: ApiListItem[] }>('/alignments');
export const getSkills = () => fetchFromApi<{ results: ApiListItem[] }>('/skills');
export const getLanguages = () => fetchFromApi<{ results: ApiListItem[] }>('/languages');
export const getBackgrounds = () => fetchFromApi<{ results: ApiListItem[] }>('/backgrounds');
export const getFeats = () => fetchFromApi<{ results: ApiListItem[] }>('/feats');

export const getRaceDetails = (index: string) => fetchFromApi<ApiRace>(`/races/${index}`);
export const getSubraceDetails = (index: string) => fetchFromApi<ApiSubrace>(`/subraces/${index}`);
export const getClassDetails = (index: string) => fetchFromApi<ApiClass>(`/classes/${index}`);
export const getSubclassDetails = (index: string) => fetchFromApi<ApiSubclass>(`/subclasses/${index}`);
export const getBackgroundDetails = (index: string) => fetchFromApi<ApiBackground>(`/backgrounds/${index}`);

export const getClassLevels = (index: string) => fetchFromApi<ApiClassLevel[]>(`/classes/${index}/levels`);
export const getSpellsForClass = (index: string) => fetchFromApi<{ results: ApiListItem[] }>(`/classes/${index}/spells`);
export const getEquipmentForCategory = (index: string) => fetchFromApi<{ equipment: ApiListItem[] }>(`/equipment-categories/${index}`);

export const getSpellDetails = (index: string) => fetchFromApi<ApiSpell>(`/spells/${index}`);
export const getTraitDetails = (index: string) => fetchFromApi<ApiTrait>(`/traits/${index}`);
export const getEquipmentDetails = (index: string) => fetchFromApi<Partial<InventoryItem>>(`/equipment/${index}`);
export const getConditionDetails = (index: string) => fetchFromApi<ApiCondition>(`/conditions/${index}`);
export const getFeatureDetails = (index: string) => fetchFromApi<ApiFeature>(`/features/${index}`);
export const getClassLevelDetails = (classIndex: string, level: number) => fetchFromApi<ApiClassLevel>(`/classes/${classIndex}/levels/${level}`);
export const getFeatDetails = (index: string) => fetchFromApi<Feat>(`/feats/${index}`);
