// backend/src/services/unifiedDataService.ts
import redisClient from '../database/redis-client.js';
import { AppDataSource } from '../database/data-source.js';
import { HomebrewContent, HomebrewContentType } from '../entities/HomebrewContent.js';
import { getResourceList as fetchResourceList, getDetails as fetchDetails } from './dndApiService.js';
import { User } from '../entities/User.js';
import { In } from 'typeorm';

const norm = (s?: string) => (s ?? '').toLowerCase().trim().replace(/\s+/g, '-');

/**
 * Retorna uma lista de recursos (ex: 'races'), unindo dados oficiais, públicos e do usuário.
 */
export async function getUnifiedList(resource: string, userId?: number): Promise<any[]> {
    const normalizedResource = norm(resource);
    const publicCacheKey = `dnd5e:${normalizedResource}:list`;
    
    // 1. Busca a lista de base oficial da API (ou do cache compartilhado).
    let officialList: { index: string; name: string; url: string }[] = [];
    const cachedPublicList = redisClient && redisClient.isOpen ? await redisClient.get(publicCacheKey) : null;
    
    if (cachedPublicList) {
        officialList = JSON.parse(cachedPublicList);
    } else {
        const apiResponse = await fetchResourceList(normalizedResource);
        officialList = apiResponse?.results || [];
        if (redisClient && redisClient.isOpen && officialList.length > 0) {
            await redisClient.set(publicCacheKey, JSON.stringify(officialList));
        }
    }
    
    // 2. Busca o conteúdo homebrew relevante.
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    const queryBuilder = homebrewRepo.createQueryBuilder('hb')
        .where('LOWER(hb.type) = :type', { type: normalizedResource });

    if (userId) {
        const userRepo = AppDataSource.getRepository(User);
        const user = await userRepo.findOne({ where: { id: userId }, select: ['installedHomebrewIds'] });
        const userInstalledIds = user?.installedHomebrewIds || [];
        
        // A query agora busca conteúdo que seja público OU que esteja na lista de instalados do usuário.
        queryBuilder.andWhere('(hb.isPublic = :isPublic OR hb.id IN (:...userInstalledIds))', { 
            isPublic: true, 
            userInstalledIds: userInstalledIds.length > 0 ? userInstalledIds : [''] // Previne erro de array vazio
        });
    } else {
        // Se não há usuário, busca apenas o público
        queryBuilder.andWhere('hb.isPublic = :isPublic', { isPublic: true });
    }
    
    const allRelevantHomebrew = await queryBuilder.getMany();
    
    // 3. Mescla as listas, dando prioridade ao Homebrew.
    const finalMap = new Map<string, any>();
    
    officialList.forEach(item => finalMap.set(norm(item.index), { ...item, source: 'official' }));

    allRelevantHomebrew.forEach(hb => {
        const content = hb.content as any;
        // Se houver um `official_index`, use-o para sobrescrever. Caso contrário, use o ID do homebrew para adicionar como novo.
        const finalIndex = content.official_index ? norm(content.official_index) : hb.id;
        
        // Mantém o nome e a URL da API oficial se o homebrew for apenas uma tradução sem nome próprio.
        const originalItem = finalMap.get(finalIndex);
        
        finalMap.set(finalIndex, { 
            index: hb.id,
            name: content.name || originalItem?.name, 
            url: `/api/data/${normalizedResource}/${hb.id}`, 
            source: 'homebrew' 
        });
    });

    return Array.from(finalMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}


/**
 * Retorna os detalhes de um recurso específico, aplicando a lógica de prioridade.
 */
export async function getUnifiedDetails(resource: string, index: string, userId?: number): Promise<any> {
    const normalizedResource = norm(resource);
    const normalizedIndex = norm(index);
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);

    const isUuid = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(normalizedIndex);

    let homebrewOverride: HomebrewContent | null = null;
    let officialIndexToFetch = normalizedIndex;

    // Se o ID for UUID, é definitivamente um homebrew.
    if (isUuid) {
        homebrewOverride = await homebrewRepo.findOneBy({ id: normalizedIndex });
        if (homebrewOverride) {
            // Se o homebrew sobrescreve um item oficial, precisamos buscar o oficial também.
            const officialIndexFromContent = (homebrewOverride.content as any)?.official_index;
            if (officialIndexFromContent) {
                officialIndexToFetch = norm(officialIndexFromContent);
            } else {
                // É um item puramente homebrew, não há base oficial para buscar.
                 if (!homebrewOverride.isPublic && homebrewOverride.authorId !== userId) {
                    throw new Error('Acesso negado a este conteúdo privado.');
                }
                return homebrewOverride.content;
            }
        } else {
            throw new Error('Conteúdo Homebrew não encontrado.');
        }
    }

    // Busca o dado oficial da API ou do cache.
    const cacheKey = `dnd5e-details:${normalizedResource}:${officialIndexToFetch}`;
    let officialData: any = null;
    
    if (redisClient && redisClient.isOpen) {
        const cachedOfficial = await redisClient.get(cacheKey);
        if (cachedOfficial) {
            officialData = JSON.parse(cachedOfficial);
        }
    }
    
    if (!officialData) {
        officialData = await fetchDetails(normalizedResource, officialIndexToFetch);
        if (officialData && redisClient && redisClient.isOpen) {
            await redisClient.set(cacheKey, JSON.stringify(officialData));
        }
    }

    if (!officialData) {
        // Se nem o oficial existe e estávamos procurando por um override, retorna o homebrew puro.
        if (homebrewOverride) return homebrewOverride.content;
        throw new Error(`Recurso '${normalizedIndex}' em '${normalizedResource}' não encontrado.`);
    }

    // Se ainda não buscamos o homebrew (porque o index não era UUID), buscamos agora.
    if (!homebrewOverride && userId) {
        const userRepo = AppDataSource.getRepository(User);
        const user = await userRepo.findOne({ where: { id: userId }, select: ['installedHomebrewIds'] });
        const installedIds = user?.installedHomebrewIds || [];

        if (installedIds.length > 0) {
            // Procura por um homebrew instalado que sobrescreva o índice oficial.
            homebrewOverride = await homebrewRepo.createQueryBuilder("hb")
                .where("hb.id IN (:...installedIds)", { installedIds })
                .andWhere("LOWER(JSON_UNQUOTE(JSON_EXTRACT(hb.content, '$.official_index'))) = :index", { index: officialIndexToFetch })
                .andWhere("LOWER(hb.type) = :type", { type: normalizedResource })
                .getOne();
        }
    }

    // Se encontramos um homebrew para sobrescrever, mesclamos. Caso contrário, retornamos o oficial.
    if (homebrewOverride) {
        // Merge profundo simples (pode ser melhorado se necessário)
        return { ...officialData, ...homebrewOverride.content };
    }

    return officialData;
}
