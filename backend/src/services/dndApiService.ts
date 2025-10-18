// backend/src/services/dndApiService.ts
import redisClient from '../database/redis-client.js';
import fetch from 'node-fetch'; // Usando node-fetch no backend
import 'dotenv/config';

const API_BASE = 'https://www.dnd5eapi.co/api';

/**
 * Busca dados da API D&D 5e, com opção de usar ou ignorar o cache.
 * @param endpoint O endpoint da API a ser consultado (ex: '/races').
 * @param useCache Se deve tentar usar o cache do Redis. Padrão é true.
 * @returns Os dados da API ou null em caso de erro.
 */
async function fetchWithCache<T>(endpoint: string, useCache: boolean = true): Promise<T | null> {
    const safeEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    
    const cacheKey = `dnd5e:${safeEndpoint}`;

    // 1. Tenta buscar do cache primeiro (se aplicável)
    if (useCache && redisClient && redisClient.isOpen) {
        try {
            // console.log(`[Cache] GET: ${cacheKey}`);
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                // console.log(`[Cache] HIT: ${cacheKey}`);
                return JSON.parse(cachedData) as T;
            }
             // console.log(`[Cache] MISS: ${cacheKey}`);
        } catch (error) {
            console.error(`[Cache] Erro ao buscar do Redis para ${cacheKey}:`, error);
        }
    }
    
    // 2. Busca na API
    const fullApiUrl = `${API_BASE}${safeEndpoint}`;
    // console.log(`[API Fetch] Buscando URL: ${fullApiUrl}`);
    try {
        const response = await fetch(fullApiUrl);
        if (!response.ok) {
            console.error(`[API Fetch] Erro ${response.status} para o endpoint ${safeEndpoint}. URL: ${fullApiUrl}`);
            return null;
        }
        const data = await response.json();

        // 3. Salva no cache se aplicável
        if (useCache && redisClient && redisClient.isOpen) {
            try {
                // console.log(`[Cache] SET: ${cacheKey}`);
                await redisClient.set(cacheKey, JSON.stringify(data));
            } catch (error) {
                 console.error(`[Cache] Erro ao salvar no Redis para ${cacheKey}:`, error);
            }
        }

        return data as T;
    } catch (error) {
        console.error(`[API Fetch] Erro de fetch para o endpoint ${safeEndpoint}:`, error);
        return null;
    }
}

/**
 * Obtém uma lista de recursos de um endpoint principal (ex: 'races', 'classes').
 */
export const getResourceList = (resource: string, useCache: boolean = true) => {
    return fetchWithCache<{ count: number, results: any[] }>(`/${resource}`, useCache);
}

/**
 * Obtém os detalhes de um item específico de um recurso.
 * @param resource O nome do recurso no plural (ex: 'races').
 * @param index O índice do item (ex: 'elf', 'bard/levels').
 */
export const getDetails = (resource: string, index: string, useCache: boolean = true) => {
     return fetchWithCache<any>(`/${resource}/${index}`, useCache);
}

export const getEquipmentDetails = (index: string, useCache: boolean = true) => {
    return fetchWithCache<any>(`/equipment/${index}`, useCache);
};
