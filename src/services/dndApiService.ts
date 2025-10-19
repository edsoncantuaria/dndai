
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

const API_PREFIX = '/data';

// Cache em memória para a sessão atual do navegador
const cache = new Map<string, any>();

/* 🔹 Helper genérico de fetch com cache */
async function fetchJson<T>(endpoint: string): Promise<T> {
  const fullEndpoint = `${API_PREFIX}${endpoint}`;

  if (cache.has(fullEndpoint)) {
    return cache.get(fullEndpoint);
  }

  if (process.env.NODE_ENV === 'development') {
    console.debug(`[DndApiService] GET ${fullEndpoint}`);
  }

  const res = await apiClient<T>(fullEndpoint);
  
  cache.set(fullEndpoint, res); // Armazena a resposta no cache
  return res;
}

/* 🔹 Helper para listas no formato { results: [...] } */
async function fetchList<T extends ApiListItem>(endpoint: string): Promise<{ results: T[] }> {
  const data = await fetchJson<any>(endpoint);
  // O backend unificado pode retornar um array diretamente ou um objeto com 'results'.
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
export const getRaceDetails = (index: string) => getResourceDetails('races', index) as Promise<ApiRace>;
export const getSubraces = () => fetchList<ApiListItem>('/subraces');
export const getSubraceDetails = (index: string) => getResourceDetails('subraces', index) as Promise<ApiSubrace>;

/* ===========================================================
 * 🧑‍🎓 Classes, Subclasses e Níveis
 * =========================================================== */
export const getClasses = () => fetchList<ApiListItem>('/classes');
export const getClassDetails = (index: string) => getResourceDetails('classes', index) as Promise<ApiClass>;
export const getClassLevels = (index: string) => getResourceDetails(`classes/${index}`, 'levels') as Promise<ApiClassLevel[]>;
export const getSubclasses = () => fetchList<ApiListItem>('/subclasses');
export const getSubclassDetails = (index: string) => getResourceDetails('subclasses', index) as Promise<ApiSubclass>;
export const getSubclassLevels = (index: string) => getResourceDetails(`subclasses/${index}`, 'levels') as Promise<ApiClassLevel[]>;
export const getSpellsForClass = (index: string) => fetchList<ApiListItem>(`/classes/${index}/spells`);
export const getStartingEquipment = (index: string) => getResourceDetails(`classes/${index}`, 'starting-equipment');
export const getMultiClassing = (index: string) => getResourceDetails(`classes/${index}`, 'multi-classing');

/* ===========================================================
 * 🔮 Magias e Escolas
 * =========================================================== */
export const getSpells = () => fetchList<ApiListItem>('/spells');
export const getSpellDetails = (index: string) => getResourceDetails('spells', index) as Promise<ApiSpell>;
export const getMagicSchools = () => fetchList<ApiListItem>('/magic-schools');
export const getMagicSchoolDetails = (index: string) => getResourceDetails('magic-schools', index) as Promise<ApiMagicSchool>;

/* ===========================================================
 * 🎭 Backgrounds
 * =========================================================== */
export const getBackgrounds = () => fetchList<ApiListItem>('/backgrounds');
export const getBackgroundDetails = (index: string) => getResourceDetails('backgrounds', index) as Promise<ApiBackground>;

/* ===========================================================
 * ⚔️ Equipamentos
 * =========================================================== */
export const getEquipment = async (): Promise<InventoryItem[]> => {
    const data = await fetchList<InventoryItem>('/equipment');
    return data.results || [];
};
export const getEquipmentDetails = (index: string) => getResourceDetails('equipment', index) as Promise<InventoryItem>;
export const getWeaponProperties = () => fetchList<ApiListItem>('/weapon-properties');
export const getWeaponPropertyDetails = (index: string) => getResourceDetails('weapon-properties', index) as Promise<ApiWeaponProperty>;
export const getEquipmentCategories = () => fetchList<ApiListItem>('/equipment-categories');
export const getEquipmentCategoryDetails = (index: string) => getResourceDetails('equipment-categories', index) as Promise<{ equipment: InventoryItem[] }>;



/* ===========================================================
 * 💪 Habilidades, Proficiências e Idiomas
 * =========================================================== */
export const getAbilityScores = () => fetchList<ApiListItem>('/ability-scores');
export const getAbilityScoreDetails = (index: string) => getResourceDetails('ability-scores', index) as Promise<ApiAbilityScore>;
export const getSkills = () => fetchList<ApiListItem>('/skills');
export const getSkillDetails = (index: string) => getResourceDetails('skills', index) as Promise<ApiSkill>;
export const getProficiencies = () => fetchList<ApiListItem>('/proficiencies');
export const getProficiencyDetails = (index: string) => getResourceDetails('proficiencies', index) as Promise<ApiProficiency>;
export const getLanguages = () => fetchList<ApiListItem>('/languages');
export const getLanguageDetails = (index: string) => getResourceDetails('languages', index) as Promise<ApiLanguage>;

/* ===========================================================
 * 🧩 Traits, Features e Feats
 * =========================================================== */
export const getTraits = () => fetchList<ApiListItem>('/traits');
export const getTraitDetails = (index: string) => getResourceDetails('traits', index) as Promise<ApiTrait>;
export const getFeatures = () => fetchList<ApiListItem>('/features');
export const getFeatureDetails = (index: string) => getResourceDetails('features', index) as Promise<ApiFeature>;
export const getFeats = () => fetchList<ApiListItem>('/feats');
export const getFeatDetails = (index: string) => getResourceDetails('feats', index) as Promise<Feat>;

/* ===========================================================
 * 🧟 Monstros
 * =========================================================== */
export const getMonsters = () => fetchList<ApiListItem>('/monsters');
export const getMonsterDetails = (index: string) => getResourceDetails('monsters', index) as Promise<ApiMonster>;

/* ===========================================================
 * 📜 Regras e Seções
 * =========================================================== */
export const getRules = () => fetchList<ApiListItem>('/rules');
export const getRuleDetails = (index: string) => getResourceDetails('rules', index) as Promise<ApiRule>;
export const getRuleSections = () => fetchList<ApiListItem>('/rule-sections');
export const getRuleSectionDetails = (index: string) => getResourceDetails('rule-sections', index) as Promise<ApiRuleSection>;

/* ===========================================================
 * ⚖️ Condições e Alinhamentos
 * =========================================================== */
export const getConditions = () => fetchList<ApiListItem>('/conditions');
export const getConditionDetails = (index: string) => getResourceDetails('conditions', index) as Promise<ApiCondition>;
export const getAlignments = () => fetchList<ApiListItem>('/alignments');
export const getAlignmentDetails = (index: string) => getResourceDetails('alignments', index) as Promise<ApiAlignment>;


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
  getEquipment, getEquipmentDetails, getWeaponProperties, getWeaponPropertyDetails, getEquipmentCategories, getEquipmentCategoryDetails,

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
