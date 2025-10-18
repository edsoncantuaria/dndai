// backend/src/services/dndApiService.ts
import redisClient from '../database/redis-client.js';
import fetch from 'node-fetch';
import 'dotenv/config';

const API_BASE = 'https://www.dnd5eapi.co/api';

async function fetchWithCache<T>(endpoint: string): Promise<T | null> {
    const safeEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const cacheKey = `dnd5e:${safeEndpoint.substring(1).replace(/\//g, ':')}`;

    if (redisClient && redisClient.isOpen) {
        try {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                // O cache aqui é apenas para os dados brutos da API oficial
                return JSON.parse(cachedData) as T;
            }
        } catch (error) {
            console.error(`[dndApiService-Cache] Erro ao buscar do Redis para ${cacheKey}:`, error);
        }
    }
    
    const fullApiUrl = `${API_BASE}${safeEndpoint}`;
    try {
        const response = await fetch(fullApiUrl);
        if (!response.ok) {
            console.error(`[dndApiService-API] Erro ${response.status} para o endpoint ${safeEndpoint}.`);
            return null;
        }
        const data = await response.json();

        if (redisClient && redisClient.isOpen) {
            try {
                // Cache persistente (sem expiração) para dados estáticos do SRD
                await redisClient.set(cacheKey, JSON.stringify(data));
            } catch (error) {
                 console.error(`[dndApiService-Cache] Erro ao salvar no Redis para ${cacheKey}:`, error);
            }
        }

        return data as T;
    } catch (error) {
        console.error(`[dndApiService-API] Erro de fetch para o endpoint ${safeEndpoint}:`, error);
        return null;
    }
}

export const getResourceList = (resource: string) => {
    return fetchWithCache<{ count: number, results: any[] }>(`/${resource}`);
}

export const getDetails = (resource: string, index: string) => {
     return fetchWithCache<any>(`/${resource}/${index}`);
}
