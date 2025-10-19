// src/services/dndApiService.ts
import { apiClient } from './apiClient';
import type {
  ApiRace,
  ApiSubrace,
  ApiClass,
  ApiSubclass,
  ApiBackground,
  ApiClassLevel,
  ApiSpell,
  ApiTrait,
  ApiListItem,
  ApiFeature,
  ApiMonster,
  ApiSkill,
  ApiProficiency,
  ApiLanguage,
  ApiCondition,
  ApiMagicSchool,
  ApiAlignment,
  ApiAbilityScore,
  ApiRule,
  ApiRuleSection,
  ApiWeaponProperty,
  Feat,
  InventoryItem
} from '../types';

// Cache em memória para a sessão atual do navegador
const cache = new Map<string, any>();

/* 🔹 Helper genérico de fetch com cache */
async function fetchJson<T>(endpoint: string): Promise<T> {
  if (cache.has(endpoint)) {
    return cache.get(endpoint);
  }

  if (process.env.NODE_ENV === 'development') {
    console.debug(`[DndApiService] GET ${endpoint}`);
  }

  // Corrigido: Garante que o endpoint final seja /api/data/...
  const finalEndpoint = `/api/data${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  const res = await apiClient<T>(finalEndpoint);
  
  cache.set(endpoint, res); // Armazena a resposta no cache
  return res;
}

/* 🔹 Helper para listas no formato { results: [...] } */
async function fetchList<T extends ApiListItem>(endpoint: string): Promise<{ results: T[] }> {
  const data = await fetchJson<any>(endpoint);
  // O backend unificado já garante o formato { results: [...] }, mas mantemos a segurança
  const results = Array.isArray(data) ? data : data?.results || [];
  return { results };
}

/* 🔹 Helper inteligente para detalhes */
export async function getResourceDetails(resource: string, index: string): Promise<any> {
    const data = await fetchJson<any>(`/${resource}/${index}`);

    if (Array.isArray(data)) {
        return data;
    }

    if (data && typeof data === 'object' && 'levels' in data && Array.isArray(data.levels)) {
        return data.levels;
    }

    return data || {};
}


/* ===========================================================
 * 🧬 Raças e Sub-raças
 * =========================================================== */
export const getRaces = () => fetchList<ApiListItem>('/races');
export const getRaceDetails = (index: string) => getResourceDetails('races', index);
export const getSubraces = () => fetchList<ApiListItem>('/subraces');
export const getSubraceDetails = (index: string) => getResourceDetails('subraces', index);

/* ===========================================================
 * 🧑‍🎓 Classes, Subclasses e Níveis
 * =========================================================== */
export const getClasses = () => fetchList<ApiListItem>('/classes');
export const getClassDetails = (index: string) => getResourceDetails('classes', index);
export const getClassLevels = (index: string) => getResourceDetails(`classes/${index}`, 'levels');
export const getSubclasses = () => fetchList<ApiListItem>('/subclasses');
export const getSubclassDetails = (index: string) => getResourceDetails('subclasses', index);
export const getSubclassLevels = (index: string) => getResourceDetails(`subclasses/${index}`, 'levels');
export const getSpellsForClass = (index: string) => fetchList<ApiListItem>(`/classes/${index}/spells`);
export const getStartingEquipment = (index: string) => getResourceDetails(`classes/${index}`, 'starting-equipment');
export const getMultiClassing = (index: string) => getResourceDetails(`classes/${index}`, 'multi-classing');

/* ===========================================================
 * 🔮 Magias e Escolas
 * =========================================================== */
export const getSpells = () => fetchList<ApiListItem>('/spells');
export const getSpellDetails = (index: string) => getResourceDetails('spells', index);
export const getMagicSchools = () => fetchList<ApiListItem>('/magic-schools');
export const getMagicSchoolDetails = (index: string) => getResourceDetails('magic-schools', index);

/* ===========================================================
 * 🎭 Backgrounds
 * =========================================================== */
export const getBackgrounds = () => fetchList<ApiListItem>('/backgrounds');
export const getBackgroundDetails = (index: string) => getResourceDetails('backgrounds', index);

/* ===========================================================
 * ⚔️ Equipamentos
 * =========================================================== */
export const getEquipment = () => fetchList<InventoryItem>('/equipment');
export const getEquipmentDetails = (index: string) => getResourceDetails('equipment', index);
export const getWeaponProperties = () => fetchList<ApiListItem>('/weapon-properties');
export const getWeaponPropertyDetails = (index: string) => getResourceDetails('weapon-properties', index);
export const getEquipmentCategories = () => fetchList<ApiListItem>('/equipment-categories');


/* ===========================================================
 * 💪 Habilidades, Proficiências e Idiomas
 * =========================================================== */
export const getAbilityScores = () => fetchList<ApiListItem>('/ability-scores');
export const getAbilityScoreDetails = (index: string) => getResourceDetails('ability-scores', index);
export const getSkills = () => fetchList<ApiListItem>('/skills');
export const getSkillDetails = (index: string) => getResourceDetails('skills', index);
export const getProficiencies = () => fetchList<ApiListItem>('/proficiencies');
export const getProficiencyDetails = (index: string) => getResourceDetails('proficiencies', index);
export const getLanguages = () => fetchList<ApiListItem>('/languages');
export const getLanguageDetails = (index: string) => getResourceDetails('languages', index);

/* ===========================================================
 * 🧩 Traits, Features e Feats
 * =========================================================== */
export const getTraits = () => fetchList<ApiListItem>('/traits');
export const getTraitDetails = (index: string) => getResourceDetails('traits', index);
export const getFeatures = () => fetchList<ApiListItem>('/features');
export const getFeatureDetails = (index: string) => getResourceDetails('features', index);
export const getFeats = () => fetchList<ApiListItem>('/feats');
export const getFeatDetails = (index: string) => getResourceDetails('feats', index);

/* ===========================================================
 * 🧟 Monstros
 * =========================================================== */
export const getMonsters = () => fetchList<ApiListItem>('/monsters');
export const getMonsterDetails = (index: string) => getResourceDetails('monsters', index);

/* ===========================================================
 * 📜 Regras e Seções
 * =========================================================== */
export const getRules = () => fetchList<ApiListItem>('/rules');
export const getRuleDetails = (index: string) => getResourceDetails('rules', index);
export const getRuleSections = () => fetchList<ApiListItem>('/rule-sections');
export const getRuleSectionDetails = (index: string) => getResourceDetails('rule-sections', index);

/* ===========================================================
 * ⚖️ Condições e Alinhamentos
 * =========================================================== */
export const getConditions = () => fetchList<ApiListItem>('/conditions');
export const getConditionDetails = (index: string) => getResourceDetails('conditions', index);
export const getAlignments = () => fetchList<ApiListItem>('/alignments');
export const getAlignmentDetails = (index: string) => getResourceDetails('alignments', index);


/* ===========================================================
 * 🔹 Export unificado
 * =========================================================== */
const DndApiService = {
  // Races
  getRaces, getRaceDetails, getSubraces, getSubraceDetails,

  // Classes
  getClasses, getClassDetails, getClassLevels, getSubclasses, getSubclassDetails,
  getSpellsForClass, getStartingEquipment, getMultiClassing, getSubclassLevels,

  // Spells
  getSpells, getSpellDetails, getMagicSchools, getMagicSchoolDetails,

  // Backgrounds
  getBackgrounds, getBackgroundDetails,

  // Equipment
  getEquipment, getEquipmentDetails, getWeaponProperties, getWeaponPropertyDetails, getEquipmentCategories,

  // Abilities & Skills
  getAbilityScores, getAbilityScoreDetails, getSkills, getSkillDetails,
  getProficiencies, getProficiencyDetails, getLanguages, getLanguageDetails,

  // Traits, Features, Feats
  getTraits, getTraitDetails, getFeatures, getFeatureDetails, getFeats, getFeatDetails,

  // Monsters
  getMonsters, getMonsterDetails,

  // Rules
  getRules, getRuleDetails, getRuleSections, getRuleSectionDetails,

  // Conditions & Alignments
  getConditions, getConditionDetails, getAlignments, getAlignmentDetails,
};

export default DndApiService;
