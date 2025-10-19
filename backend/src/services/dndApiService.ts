// backend/src/services/dndApiService.ts
import fetch from 'node-fetch';
import redisClient from '../database/redis-client.js';

const API_BASE = 'https://www.dnd5eapi.co/api/2014';

/**
 * Normaliza uma string para uso em chaves de cache.
 */
const norm = (s?: string) => (s ?? '').toLowerCase().trim();

/**
 * Gera uma chave consistente para o cache Redis.
 * Ex: dnd5e:v2014:equipment:list ou dnd5e:v2014:equipment:greataxe
 */
const cacheKey = (resource: string, index?: string) => {
  return index
    ? `dnd5e:v2014:${norm(resource)}:${norm(index)}`
    : `dnd5e:v2014:${norm(resource)}:list`;
};

/**
 * Faz o fetch da API oficial D&D 5e, com cache no Redis global.
 * - Todos os dados oficiais são compartilhados entre todos os usuários.
 * - Não há expiração (dados estáticos).
 */
async function fetchWithCache<T>(endpoint: string, redisKey: string): Promise<T | null> {
  if (redisClient && redisClient.isOpen) {
    try {
      const cached = await redisClient.get(redisKey);
      if (cached) {
        // Validação robusta do cache
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          console.log(`[DndApiService] Cache HIT: ${redisKey}`);
          return parsed as T;
        }
        console.warn(`[DndApiService] Cache INVÁLIDO para ${redisKey}. Buscando novamente.`);
      }
    } catch (err) {
      console.error(`[Cache] Erro ao ler chave ${redisKey}:`, err);
    }
  }

  const fullUrl = `${API_BASE}${endpoint}`;
  console.log(`[DndApiService] Fetching from API: ${fullUrl}`);

  try {
    const response = await fetch(fullUrl);
    if (!response.ok) {
      console.error(`[DndApiService] Erro ${response.status} ao buscar ${endpoint}`);
      return null;
    }

    const data = (await response.json()) as T;

    if (redisClient && redisClient.isOpen && data) {
      try {
        await redisClient.set(redisKey, JSON.stringify(data));
        console.log(`[Cache] SET persistente: ${redisKey}`);
      } catch (err) {
        console.error(`[Cache] Falha ao salvar ${redisKey}:`, err);
      }
    }

    return data;
  } catch (err) {
    console.error(`[DndApiService] Erro ao buscar ${endpoint}:`, err);
    return null;
  }
}

/**
 * Obtém uma lista de recursos (ex: /races, /classes, /equipment).
 */
export async function getResourceList(resource: string): Promise<{ count: number; results: any[] } | null> {
  const key = cacheKey(resource);
  return fetchWithCache<{ count: number; results: any[] }>(`/${resource}`, key);
}

/**
 * Obtém detalhes de um item específico (ex: /classes/barbarian, /equipment/greataxe).
 * Garante que sempre retorne um objeto, mesmo em caso de falha, para segurança no merge.
 */
export async function getResourceDetails(resource: string, index: string): Promise<any | null> {
  const key = cacheKey(resource, index);
  return await fetchWithCache<any>(`/${resource}/${index}`, key) || {}; // Retorna objeto vazio em falha
}

/**
 * Obtém os níveis de uma classe.
 */
export const getClassLevels = async (classIndex: string) => {
    return getResourceDetails(`classes/${classIndex}`, 'levels');
};

/**
 * Obtém os níveis de uma subclasse.
 */
export const getSubclassLevels = async (subclassIndex: string) => {
    return getResourceDetails(`subclasses/${subclassIndex}`, 'levels');
};

/**
 * Obtém as magias de uma classe.
 */
export const getSpellsForClass = async (classIndex: string) => {
    return getResourceDetails(`classes/${classIndex}`, 'spells');
};


/**
 * Atalhos de conveniência para os principais recursos usados no jogo.
 */
const DndApi = {
  getAbilityScores: () => getResourceList('ability-scores'),
  getAlignments: () => getResourceList('alignments'),
  getBackgrounds: () => getResourceList('backgrounds'),
  getClasses: () => getResourceList('classes'),
  getConditions: () => getResourceList('conditions'),
  getDamageTypes: () => getResourceList('damage-types'),
  getEquipment: () => getResourceList('equipment'),
  getEquipmentCategories: () => getResourceList('equipment-categories'),
  getFeats: () => getResourceList('feats'),
  getLanguages: () => getResourceList('languages'),
  getMagicSchools: () => getResourceList('magic-schools'),
  getMonsters: () => getResourceList('monsters'),
  getProficiencies: () => getResourceList('proficiencies'),
  getRaces: () => getResourceList('races'),
  getSkills: () => getResourceList('skills'),
  getSpells: () => getResourceList('spells'),
  getSubclasses: () => getResourceList('subclasses'),
  getSubraces: () => getResourceList('subraces'),
  getTraits: () => getResourceList('traits'),

  // Detalhes individuais
  getDetails: (resource: string, index: string) => getResourceDetails(resource, index),

  // Expor também as funções base diretamente
  getResourceList,
  getResourceDetails
};

export { DndApi };
export default DndApi;
