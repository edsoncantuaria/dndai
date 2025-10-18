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
} from '../types';

/**
 * -------------------------------
 * 🔹 Funções de Lista (List endpoints)
 * -------------------------------
 * Chamam o novo endpoint unificado: /api/data/:resource
 */
export const getResourceList = async <T = any>(resource: string): Promise<T[]> => {
  const res = await apiClient<T[]>(`/data/${resource}`);
  return res;
};

// Atalhos específicos (apenas para clareza e autocomplete)
export const getRaces = () => getResourceList<ApiRace>('races');
export const getClasses = () => getResourceList<ApiClass>('classes');
export const getBackgrounds = () => getResourceList<ApiBackground>('backgrounds');
export const getFeats = () => getResourceList<Feat>('feats');
export const getTraits = () => getResourceList<ApiTrait>('traits');
export const getEquipment = () => getResourceList<InventoryItem>('equipment');
export const getLanguages = () => getResourceList<{ name: string; index: string }>('languages');
export const getConditions = () => getResourceList<ApiCondition>('conditions');
export const getAlignments = () => getResourceList<{ name: string; index: string }>('alignments');
export const getSkills = () => getResourceList<{ name: string; index: string }>('skills');
export const getSubclasses = () => getResourceList<ApiSubclass>('subclasses');
export const getSpells = () => getResourceList<ApiSpell>('spells');

/**
 * -------------------------------
 * 🔹 Funções de Detalhes (Detail endpoints)
 * -------------------------------
 * Chamam o novo endpoint unificado: /api/data/:resource/:index
 */
export const getResourceDetails = async <T = any>(resource: string, index: string): Promise<T> => {
  const res = await apiClient<T>(`/data/${resource}/${index}`);
  return res;
};

// Atalhos específicos
export const getRaceDetails = (index: string) => getResourceDetails<ApiRace>('races', index);
export const getClassDetails = (index: string) => getResourceDetails<ApiClass>('classes', index);
export const getBackgroundDetails = (index: string) => getResourceDetails<ApiBackground>('backgrounds', index);
export const getFeatDetails = (index: string) => getResourceDetails<Feat>('feats', index);
export const getTraitDetails = (index: string) => getResourceDetails<ApiTrait>('traits', index);
export const getSpellDetails = (index: string) => getResourceDetails<ApiSpell>('spells', index);
export const getEquipmentDetails = (index: string) => getResourceDetails<InventoryItem>('equipment', index);
export const getConditionDetails = (index: string) => getResourceDetails<ApiCondition>('conditions', index);
export const getSubclassDetails = (index: string) => getResourceDetails<ApiSubclass>('subclasses', index);
export const getFeatureDetails = (index: string) => getResourceDetails<ApiFeature>('features', index);
