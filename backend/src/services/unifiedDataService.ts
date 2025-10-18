// backend/src/services/unifiedDataService.ts
import redisClient from '../database/redis-client.js';
import { getResourceList as fetchResourceList, getDetails as fetchDetails } from './dndApiService.js';
import { AppDataSource } from '../database/data-source.js';
import { HomebrewContent } from '../entities/HomebrewContent.js';
import { User } from '../entities/User.js';
import { In, Like } from 'typeorm';

const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 horas para o cache compartilhado

const normalize = (s?: string) => (s ?? '').toLowerCase().trim();

/**
 * Retorna uma lista de recursos (ex: 'races'), unindo dados oficiais, públicos e do usuário.
 */
export async function getUnifiedList(resource: string, userId?: number): Promise<any[]> {
    const normalizedResource = normalize(resource);
    const publicCacheKey = `dnd5e:${normalizedResource}`;
    
    // 1. Busca a lista de nomes/índices da API oficial ou do cache público.
    let officialList: { index: string; name: string; url: string }[] = [];
    const cachedPublicList = redisClient && redisClient.isOpen ? await redisClient.get(publicCacheKey) : null;
    
    if (cachedPublicList) {
        console.log(`[Cache] HIT: Usando lista pública compartilhada para ${normalizedResource}.`);
        officialList = JSON.parse(cachedPublicList);
    } else {
        console.log(`[Cache] MISS: Buscando lista oficial para ${normalizedResource} da D&D API.`);
        const apiResponse = await fetchResourceList(normalizedResource);
        officialList = apiResponse?.results || [];
        if (redisClient && redisClient.isOpen && officialList.length > 0) {
            await redisClient.set(publicCacheKey, JSON.stringify(officialList), { EX: CACHE_TTL_SECONDS });
        }
    }
    
    // 2. Busca todo o conteúdo homebrew relevante (público da comunidade + IA + privado/instalado do usuário).
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    const homebrewQuery = homebrewRepo.createQueryBuilder('hb')
        .where('hb.type = :type', { type: normalizedResource })
        .andWhere('(hb.isPublic = :isPublic OR hb.authorId = :userId)', { isPublic: true, userId: userId || -1 }); // -1 para não encontrar nada se não houver user

    if (userId) {
        const user = await AppDataSource.getRepository(User).findOneBy({ id: userId });
        const installedIds = user?.installedHomebrewIds || [];
        if (installedIds.length > 0) {
            homebrewQuery.orWhere('hb.id IN (:...installedIds)', { installedIds });
        }
    }
    
    const allRelevantHomebrew = await homebrewQuery.getMany();
    
    // 3. Mescla as listas, dando prioridade ao Homebrew.
    const finalMap = new Map<string, any>();
    
    // Adiciona a base oficial primeiro
    officialList.forEach(item => finalMap.set(item.index, { ...item, source: 'official' }));

    // Sobrescreve e adiciona com o conteúdo homebrew
    allRelevantHomebrew.forEach(hb => {
        const content = hb.content as any;
        const index = content.official_index || hb.id;
        const displayName = hb.authorId === userId ? `(Meu) ${hb.name}` : `(H) ${hb.name}`;
        
        // Se ele sobrescreve um item oficial ou é um item novo, adiciona/substitui no mapa.
        finalMap.set(index, { index: hb.id, name: displayName, url: `/api/data/${normalizedResource}/${hb.id}`, source: 'homebrew' });
    });

    return Array.from(finalMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}


/**
 * Retorna os detalhes de um recurso específico, aplicando a lógica de prioridade.
 */
export async function getUnifiedDetails(resource: string, index: string, userId?: number): Promise<any> {
    const normalizedResource = normalize(resource);
    const normalizedIndex = normalize(index);

    // Identifica se estamos buscando por um UUID de homebrew ou por um índice oficial.
    const isUuid = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(normalizedIndex);

    let homebrewOverride: HomebrewContent | null = null;
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);

    if (isUuid) {
        // Se for UUID, busca diretamente.
        homebrewOverride = await homebrewRepo.findOneBy({ id: normalizedIndex });
    } else if (userId) {
        // Se for um índice (ex: 'longsword'), procura por um override instalado/privado.
        const user = await AppDataSource.getRepository(User).findOneBy({ id: userId });
        const installedIds = user?.installedHomebrewIds || [];
        
        if (installedIds.length > 0) {
            const query = homebrewRepo.createQueryBuilder("hb")
                .where("hb.id IN (:...installedIds)", { installedIds })
                .andWhere("JSON_UNQUOTE(JSON_EXTRACT(hb.content, '$.official_index')) = :index", { index: normalizedIndex });
            
            homebrewOverride = await query.getOne();
        }
        // Se não encontrar nos instalados, busca nos privados do próprio usuário.
        if (!homebrewOverride) {
            const query = homebrewRepo.createQueryBuilder("hb")
                .where("hb.authorId = :userId", { userId })
                .andWhere("JSON_UNQUOTE(JSON_EXTRACT(hb.content, '$.official_index')) = :index", { index: normalizedIndex });
            
            homebrewOverride = await query.getOne();
        }
    }
    
    // Se encontramos um homebrew, ele tem prioridade máxima.
    if (homebrewOverride) {
        if (!homebrewOverride.isPublic && homebrewOverride.authorId !== userId) {
            throw new Error('Acesso negado a este conteúdo privado.');
        }
        return homebrewOverride.content;
    }
    
    // Se era um UUID mas não foi encontrado, é um erro.
    if (isUuid) {
        throw new Error('Conteúdo Homebrew não encontrado.');
    }

    // Se não há override, busca o conteúdo oficial da API ou do cache.
    const cacheKey = `dnd5e-details:${normalizedResource}:${normalizedIndex}`;
    const cachedOfficial = redisClient && redisClient.isOpen ? await redisClient.get(cacheKey) : null;
    
    let officialData: any;
    if (cachedOfficial) {
        console.log(`[Cache] HIT: Detalhes para ${normalizedIndex} de ${normalizedResource}.`);
        officialData = JSON.parse(cachedOfficial);
    } else {
        console.log(`[Cache] MISS: Buscando detalhes para ${normalizedIndex} da D&D API.`);
        officialData = await fetchDetails(normalizedResource, normalizedIndex);
        if (officialData && redisClient && redisClient.isOpen) {
            await redisClient.set(cacheKey, JSON.stringify(officialData), { EX: CACHE_TTL_SECONDS });
        }
    }

    if (!officialData) {
        throw new Error(`Recurso '${normalizedIndex}' em '${normalizedResource}' não encontrado.`);
    }

    return officialData;
}
