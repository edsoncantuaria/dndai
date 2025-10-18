// backend/src/services/dndApiService.ts
import redisClient from '../database/redis-client.js';
import fetch from 'node-fetch';
import 'dotenv/config';

const API_BASE = 'https://www.dnd5eapi.co/api';
const CACHE_TTL_SECONDS = 24 * 60 * 60; // Cache de 24 horas para dados da API externa

async function fetchWithCache<T>(endpoint: string): Promise<T | null> {
    const safeEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const cacheKey = `dnd5e:${safeEndpoint}`;

    if (redisClient && redisClient.isOpen) {
        try {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                return JSON.parse(cachedData) as T;
            }
        } catch (error) {
            console.error(`[Cache] Erro ao buscar do Redis para ${cacheKey}:`, error);
        }
    }
    
    const fullApiUrl = `${API_BASE}${safeEndpoint}`;
    try {
        const response = await fetch(fullApiUrl);
        if (!response.ok) {
            console.error(`[API Fetch] Erro ${response.status} para o endpoint ${safeEndpoint}.`);
            return null;
        }
        const data = await response.json();

        if (redisClient && redisClient.isOpen) {
            try {
                await redisClient.set(cacheKey, JSON.stringify(data), { EX: CACHE_TTL_SECONDS });
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

export const getResourceList = (resource: string) => {
    return fetchWithCache<{ count: number, results: any[] }>(`/${resource}`);
}

export const getDetails = (resource: string, index: string) => {
     return fetchWithCache<any>(`/${resource}/${index}`);
}

export const getEquipmentDetails = (index: string) => {
    return fetchWithCache<any>(`/equipment/${index}`);
};
