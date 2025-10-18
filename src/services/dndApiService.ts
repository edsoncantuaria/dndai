// frontend/src/services/dndApiService.ts
import { apiClient } from './apiClient';
import type {
  ApiRace,
  ApiClass,
  ApiListItem,
  ApiBackground,
  ApiSpell,
  ApiTrait,
  InventoryItem,
  ApiCondition,
  ApiFeature,
  ApiSubclass,
  Feat,
  ApiClassLevel,
} from '../types';

type ListResponse = { count: number; results: ApiListItem[] };

function normalizeList(data: any): ListResponse {
  if (Array.isArray(data)) {
    return { count: data.length, results: data };
  }
  if (data && Array.isArray(data.results)) {
    return data as ListResponse;
  }
  return { count: 0, results: [] };
}


/**
 * -------------------------------
 * 🔹 Funções de Lista (List endpoints)
 * -------------------------------
 * Chamam o novo endpoint unificado: /api/data/:resource
 */
export const getResourceList = async (resource: string): Promise<ListResponse> => {
  const res = await apiClient<any>(`/data/${resource}`);
  return normalizeList(res);
};

/**
 * -------------------------------
 * 🔹 Funções de Detalhes (Detail endpoints)
 * -------------------------------
 * Chamam o novo endpoint unificado: /api/data/:resource/:index
 */
export const getResourceDetails = async <T = any>(resource: string, index: string): Promise<T | null> => {
  if (!index) return null;
  try {
    const res = await apiClient<T>(`/data/${resource}/${index}`);
    return res;
  } catch(e) {
    console.error(`Falha ao buscar detalhes para ${resource}/${index}`, e);
    return null;
  }
};

// --- ALIASES DE COMPATIBILIDADE ---
// Mantém os hooks antigos funcionando até que sejam refatorados.

export const getRaces = () => getResourceList('races');
export const getClasses = () => getResourceList('classes');
export const getSubraces = () => getResourceList('subraces');
export const getBackgrounds = () => getResourceList('backgrounds');
export const getAlignments = () => getResourceList('alignments');
export const getLanguages = () => getResourceList('languages');
export const getFeats = () => getResourceList('feats');
export const getTraits = () => getResourceList('traits');
export const getEquipment = () => getResourceList('equipment');
export const getSkills = () => getResourceList('skills');
export const getSpells = () => getResourceList('spells');
export const getDamageTypes = () => getResourceList('damage-types');
export const getMagicSchools = () => getResourceList('magic-schools');
export const getConditions = () => getResourceList('conditions');
export const getEquipmentCategories = () => getResourceList('equipment-categories');

export const getRaceDetails = (index: string) => getResourceDetails<ApiRace>('races', index);
export const getSubraceDetails = (index: string) => getResourceDetails<ApiSubrace>('subraces', index);
export const getClassDetails = (index: string) => getResourceDetails<ApiClass>('classes', index);
export const getBackgroundDetails = (index: string) => getResourceDetails<ApiBackground>('backgrounds', index);
export const getSpellDetails = (index: string) => getResourceDetails<ApiSpell>('spells', index);
export const getEquipmentDetails = (index: string) => getResourceDetails<InventoryItem>('equipment', index);
export const getFeatDetails = (index: string) => getResourceDetails<Feat>('feats', index);
export const getTraitDetails = (index: string) => getResourceDetails<ApiTrait>('traits', index);
export const getConditionDetails = (index: string) => getResourceDetails<ApiCondition>('conditions', index);
export const getFeatureDetails = (index: string) => getResourceDetails<ApiFeature>('features', index);
export const getSubclassDetails = (index: string) => getResourceDetails<ApiSubclass>('subclasses', index);
export const getSkillDetails = (index: string) => getResourceDetails('skills', index);


// Funções para rotas aninhadas
export const getClassLevels = (classIndex: string) => getResourceDetails<ApiClassLevel[]>(`classes/${classIndex}`, 'levels');
export const getSubclassLevels = (subclassIndex: string) => getResourceDetails<ApiClassLevel[]>(`subclasses/${subclassIndex}`, 'levels');
export const getSpellsForClass = (classIndex: string) => getResourceList(`classes/${classIndex}/spells`);
