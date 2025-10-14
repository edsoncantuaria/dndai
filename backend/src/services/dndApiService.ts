// backend/src/services/dndApiService.ts
import redisClient from '../database/redis-client.js';
import fetch from 'node-fetch'; // Usando node-fetch no backend
import 'dotenv/config';

const API_BASE = 'https://www.dnd5eapi.co/api';
const CACHE_DURATION_SECONDS = 60 * 60 * 24; // Cache por 24 horas

/**
 * Busca dados da API D&D 5e com cache no Redis.
 * @param endpoint O endpoint da API a ser consultado (ex: '/races').
 * @returns Os dados da API ou null em caso de erro.
 */
async function fetchWithCache<T>(endpoint: string): Promise<T | null> {
    const cacheKey = `dnd5e:${endpoint}`;

    // 1. Tenta buscar do cache primeiro
    if (redisClient) {
        try {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                console.log(`[Cache] HIT: ${cacheKey}`);
                return JSON.parse(cachedData) as T;
            }
        } catch (error) {
            console.error(`[Cache] Erro ao buscar do Redis para ${cacheKey}:`, error);
        }
    }
    
    console.log(`[Cache] MISS: ${cacheKey}. Buscando da API...`);
    // 2. Se não estiver no cache (ou o Redis estiver indisponível), busca na API
    try {
        const response = await fetch(`${API_BASE}${endpoint}`);
        if (!response.ok) {
            console.error(`API Error: ${response.status} for endpoint ${endpoint}`);
            return null;
        }
        const data = await response.json();

        // 3. Salva no cache se o Redis estiver disponível e a conexão estiver aberta
        if (redisClient && redisClient.isOpen) {
            try {
                await redisClient.set(cacheKey, JSON.stringify(data), {
                    EX: CACHE_DURATION_SECONDS, // Define o tempo de expiração
                });
            } catch (error) {
                 console.error(`[Cache] Erro ao salvar no Redis para ${cacheKey}:`, error);
            }
        }

        return data as T;
    } catch (error) {
        console.error(`Fetch Error for endpoint ${endpoint}:`, error);
        return null;
    }
}

/**
 * Obtém uma lista de recursos de um endpoint principal (ex: '/races', '/classes').
 * @param resource O nome do recurso no plural (ex: 'races').
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
