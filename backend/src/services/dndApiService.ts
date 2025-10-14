// backend/src/services/dndApiService.ts
import redisClient from '../database/redis-client.js';
import fetch from 'node-fetch'; // Usando node-fetch no backend
import 'dotenv/config';

const API_BASE = 'https://www.dnd5eapi.co/api/2014';
const CACHE_DURATION_SECONDS = 60 * 60 * 24; // Cache por 24 horas

/**
 * Busca dados da API D&D 5e com cache no Redis.
 * @param endpoint O endpoint da API a ser consultado (ex: '/races').
 * @returns Os dados da API ou null em caso de erro.
 */
async function fetchWithCache<T>(endpoint: string): Promise<T | null> {
    // Garante que o endpoint comece com uma barra e remove duplicação de /api
    let safeEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    if (safeEndpoint.startsWith('/api/')) {
        safeEndpoint = safeEndpoint.substring(4);
    }
    
    const cacheKey = `dnd5e:${safeEndpoint}`;

    // 1. Tenta buscar do cache primeiro
    if (redisClient && redisClient.isOpen) {
        try {
            console.log(`[Cache] GET: ${cacheKey}`);
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                console.log(`[Cache] HIT: ${cacheKey}`);
                return JSON.parse(cachedData) as T;
            }
             console.log(`[Cache] MISS: ${cacheKey}`);
        } catch (error) {
            console.error(`[Cache] Erro ao buscar do Redis para ${cacheKey}:`, error);
        }
    } else if (redisClient) {
        console.warn(`[Cache] Cliente Redis não está aberto ou pronto. Pulando cache para ${cacheKey}`);
    }
    
    // 2. Se não estiver no cache, busca na API
    const fullApiUrl = `${API_BASE}${safeEndpoint}`;
    console.log(`[API] Buscando: ${fullApiUrl}`);
    try {
        const response = await fetch(fullApiUrl);
        if (!response.ok) {
            console.error(`API Error: ${response.status} for endpoint ${safeEndpoint}`);
            return null;
        }
        const data = await response.json();

        // 3. Salva no cache se o Redis estiver disponível e a conexão estiver aberta
        if (redisClient && redisClient.isOpen) {
            try {
                console.log(`[Cache] SET: ${cacheKey}`);
                await redisClient.set(cacheKey, JSON.stringify(data), {
                    EX: CACHE_DURATION_SECONDS, // Define o tempo de expiração
                });
            } catch (error) {
                 console.error(`[Cache] Erro ao salvar no Redis para ${cacheKey}:`, error);
            }
        }

        return data as T;
    } catch (error) {
        console.error(`Fetch Error for endpoint ${safeEndpoint}:`, error);
        return null;
    }
}

/**
 * Obtém uma lista de recursos de um endpoint principal (ex: 'races', 'classes').
 */
export const getResourceList = (resource: string) => {
    return fetchWithCache<{ results: any[] }>(`/${resource}`);
}

/**
 * Obtém os detalhes de um item específico de um recurso.
 * @param resource O nome do recurso no plural (ex: 'races').
 * @param index O índice do item (ex: 'elf', 'bard/levels').
 */
export const getDetails = (resource: string, index: string) => {
     return fetchWithCache<any>(`/${resource}/${index}`);
}
