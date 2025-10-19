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

// O backend unificado já usa /api/data, vamos manter consistência.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/data';

/* 🔹 Helper genérico de fetch */
async function fetchJson<T>(endpoint: string): Promise<T> {
  // O apiClient já adiciona /api, então não precisamos dele aqui.
  // A rota no backend é /api/data, então o endpoint deve ser /data/...
  const finalEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const res = await apiClient<T>(finalEndpoint.replace('/api', ''));
  return res;
}


/* 🔹 Helper para listas no formato { results: [...] } */
async function fetchList<T extends ApiListItem>(endpoint: string): Promise<{ results: T[] }> {
  const data = await fetchJson<any>(endpoint);
  // A API unificada já retorna um array, então essa normalização é uma camada extra de segurança.
  const results = Array.isArray(data) ? data : data?.results || [];
  return { results };
}


/* ===========================================================
 * 🧬 Raças e Sub-raças
 * =========================================================== */
export const getRaces = () => fetchList<ApiListItem>('/data/races');
export const getRaceDetails = (index: string) => fetchJson<ApiRace>(`/data/races/${index}`);
export const getSubraces = () => fetchList<ApiListItem>('/data/subraces');
export const getSubraceDetails = (index: string) => fetchJson<ApiSubrace>(`/data/subraces/${index}`);

/* ===========================================================
 * 🧑‍🎓 Classes, Subclasses e Níveis
 * =========================================================== */
export const getClasses = () => fetchList<ApiListItem>('/data/classes');
export const getClassDetails = (index: string) => fetchJson<ApiClass>(`/data/classes/${index}`);
export const getClassLevels = (index: string) => fetchJson<ApiClassLevel[]>(`/data/classes/${index}/levels`);
export const getSubclasses = () => fetchList<ApiListItem>('/data/subclasses');
export const getSubclassDetails = (index: string) => fetchJson<ApiSubclass>(`/data/subclasses/${index}`);
export const getSubclassLevels = (index: string) => fetchJson<ApiClassLevel[]>(`/data/subclasses/${index}/levels`);
export const getSpellsForClass = (index: string) => fetchList<ApiListItem>(`/data/classes/${index}/spells`);
export const getStartingEquipment = (index: string) => fetchJson<any>(`/data/classes/${index}/starting-equipment`);
export const getMultiClassing = (index: string) => fetchJson<any>(`/data/classes/${index}/multi-classing`);

/* ===========================================================
 * 🔮 Magias e Escolas
 * =========================================================== */
export const getSpells = () => fetchList<ApiListItem>('/data/spells');
export const getSpellDetails = (index: string) => fetchJson<ApiSpell>(`/data/spells/${index}`);
export const getMagicSchools = () => fetchList<ApiListItem>('/data/magic-schools');
export const getMagicSchoolDetails = (index: string) => fetchJson<ApiMagicSchool>(`/data/magic-schools/${index}`);

/* ===========================================================
 * 🎭 Backgrounds
 * =========================================================== */
export const getBackgrounds = () => fetchList<ApiListItem>('/data/backgrounds');
export const getBackgroundDetails = (index: string) => fetchJson<ApiBackground>(`/data/backgrounds/${index}`);

/* ===========================================================
 * ⚔️ Equipamentos
 * =========================================================== */
export const getEquipment = () => fetchList<InventoryItem>('/data/equipment');
export const getEquipmentDetails = (index: string) => fetchJson<InventoryItem>(`/data/equipment/${index}`);
export const getWeaponProperties = () => fetchList<ApiListItem>('/data/weapon-properties');
export const getWeaponPropertyDetails = (index: string) => fetchJson<ApiWeaponProperty>(`/data/weapon-properties/${index}`);
export const getEquipmentCategories = () => fetchList<ApiListItem>('/data/equipment-categories');


/* ===========================================================
 * 💪 Habilidades, Proficiências e Idiomas
 * =========================================================== */
export const getAbilityScores = () => fetchList<ApiListItem>('/data/ability-scores');
export const getAbilityScoreDetails = (index: string) => fetchJson<ApiAbilityScore>(`/data/ability-scores/${index}`);
export const getSkills = () => fetchList<ApiListItem>('/data/skills');
export const getSkillDetails = (index: string) => fetchJson<any>(`/data/skills/${index}`);
export const getProficiencies = () => fetchList<ApiListItem>('/data/proficiencies');
export const getProficiencyDetails = (index: string) => fetchJson<any>(`/data/proficiencies/${index}`);
export const getLanguages = () => fetchList<ApiListItem>('/data/languages');
export const getLanguageDetails = (index: string) => fetchJson<any>(`/data/languages/${index}`);

/* ===========================================================
 * 🧩 Traits, Features e Feats
 * =========================================================== */
export const getTraits = () => fetchList<ApiListItem>('/data/traits');
export const getTraitDetails = (index: string) => fetchJson<ApiTrait>(`/data/traits/${index}`);
export const getFeatures = () => fetchList<ApiListItem>('/data/features');
export const getFeatureDetails = (index: string) => fetchJson<ApiFeature>(`/data/features/${index}`);
export const getFeats = () => fetchList<ApiListItem>('/data/feats');
export const getFeatDetails = (index: string) => fetchJson<Feat>(`/data/feats/${index}`);

/* ===========================================================
 * 🧟 Monstros
 * =========================================================== */
export const getMonsters = () => fetchList<ApiListItem>('/data/monsters');
export const getMonsterDetails = (index: string) => fetchJson<any>(`/data/monsters/${index}`);

/* ===========================================================
 * 📜 Regras e Seções
 * =========================================================== */
export const getRules = () => fetchList<ApiListItem>('/data/rules');
export const getRuleDetails = (index: string) => fetchJson<ApiRule>(`/data/rules/${index}`);
export const getRuleSections = () => fetchList<ApiListItem>('/data/rule-sections');
export const getRuleSectionDetails = (index: string) => fetchJson<ApiRuleSection>(`/data/rule-sections/${index}`);

/* ===========================================================
 * ⚖️ Condições e Alinhamentos
 * =========================================================== */
export const getConditions = () => fetchList<ApiListItem>('/data/conditions');
export const getConditionDetails = (index: string) => fetchJson<ApiCondition>(`/data/conditions/${index}`);
export const getAlignments = () => fetchList<ApiListItem>('/data/alignments');
export const getAlignmentDetails = (index: string) => fetchJson<ApiAlignment>(`/data/alignments/${index}`);


/* ===========================================================
 * 🔹 Export unificado
 * =========================================================== */
const DndApiService = {
  // Races
  getRaces, getRaceDetails, getSubraces, getSubraceDetails,

  // Classes
  getClasses, getClassDetails, getClassLevels, getSubclasses, getSubclassDetails,
  getSpellsForClass, getStartingEquipment, getMultiClassing,

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
