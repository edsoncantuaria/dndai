// backend/src/services/dndApiService.ts
import redisClient from '../database/redis-client.js';
import * as SrdApi from './srdApiAdapter.js';
import { isValidResourceDetail } from './srdResourceValidation.js';

const norm = (s?: string) => (s ?? '').toLowerCase().trim();

/** v2 — invalida cache legado que guardava só levels[] como detalhe de classe */
const CACHE_SCHEMA = 'v2';

const cacheKey = (resource: string, index?: string) => {
    return index
        ? `dnd5e:${CACHE_SCHEMA}:2014:${norm(resource)}:${norm(index)}`
        : `dnd5e:${CACHE_SCHEMA}:2014:${norm(resource)}:list`;
};

async function fetchWithCache<T>(
    fetcher: () => Promise<T | null>,
    redisKey: string,
    validate?: (data: unknown) => boolean,
): Promise<T | null> {
    if (redisClient && redisClient.isOpen) {
        try {
            const cached = await redisClient.get(redisKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed && typeof parsed === 'object' && (!validate || validate(parsed))) {
                    console.log(`[DndApiService] Cache HIT: ${redisKey}`);
                    return parsed as T;
                }
                console.warn(`[DndApiService] Cache INVÁLIDO para ${redisKey}. Buscando novamente.`);
                await redisClient.del(redisKey);
            }
        } catch (err) {
            console.error(`[Cache] Erro ao ler chave ${redisKey}:`, err);
        }
    }

    const data = await fetcher();

    if (redisClient && redisClient.isOpen && data && (!validate || validate(data))) {
        try {
            await redisClient.set(redisKey, JSON.stringify(data));
            console.log(`[Cache] SET persistente: ${redisKey}`);
        } catch (err) {
            console.error(`[Cache] Falha ao salvar ${redisKey}:`, err);
        }
    }

    return data;
}

export async function getResourceList(resource: string): Promise<{ count: number; results: any[] } | null> {
    const key = cacheKey(resource);
    return fetchWithCache(() => SrdApi.list(resource), key);
}

export async function getResourceDetails(resource: string, index: string): Promise<any | null> {
    const key = cacheKey(resource, index);
    const validate = (data: unknown) => isValidResourceDetail(resource, index, data);
    const data = await fetchWithCache(() => SrdApi.get(resource, index), key, validate);

    if (Array.isArray(data)) {
        return data;
    }

    if (!validate(data)) {
        return {};
    }

    return data || {};
}

export const getClassLevels = async (classIndex: string) => {
    return getResourceDetails(`classes/${classIndex}`, 'levels');
};

export const getSubclassLevels = async (subclassIndex: string) => {
    return getResourceDetails(`subclasses/${subclassIndex}`, 'levels');
};

export const getSpellsForClass = async (classIndex: string) => {
    return getResourceDetails(`classes/${classIndex}`, 'spells');
};

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
    getFeatures: () => getResourceList('features'),
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
    getWeaponProperties: () => getResourceList('weapon-properties'),

    getDetails: (resource: string, index: string) => getResourceDetails(resource, index),
    getResourceList,
    getResourceDetails,
};

export { DndApi, SrdApi };
export default DndApi;
