// backend/src/services/unifiedDataService.ts
import redisClient from '../database/redis-client.js';
import { AppDataSource } from '../database/data-source.js';
import { HomebrewContent } from '../entities/HomebrewContent.js';
import { getResourceList as fetchResourceList, getDetails as fetchDetails } from './dndApiService.js';
import { User } from '../entities/User.js';
import { In } from 'typeorm';

const norm = (s?: string) => (s ?? '').toLowerCase().trim();

/**
 * Retorna uma lista de recursos (ex: 'races'), unindo dados oficiais, públicos e do usuário.
 */
export async function getUnifiedList(resource: string, userId?: number): Promise<any[]> {
    const normalizedResource = norm(resource);
    const publicCacheKey = `dnd5e:${normalizedResource}`;
    
    // 1. Busca a lista de base oficial da API (ou do cache compartilhado).
    let officialList: { index: string; name: string; url: string }[] = [];
    const cachedPublicList = redisClient && redisClient.isOpen ? await redisClient.get(publicCacheKey) : null;
    
    if (cachedPublicList) {
        // console.log(`[Cache] HIT: Usando lista pública compartilhada para ${normalizedResource}.`);
        officialList = JSON.parse(cachedPublicList);
    } else {
        // console.log(`[Cache] MISS: Buscando lista oficial para ${normalizedResource} da D&D API.`);
        const apiResponse = await fetchResourceList(normalizedResource);
        officialList = apiResponse?.results || [];
        if (redisClient && redisClient.isOpen && officialList.length > 0) {
            await redisClient.set(publicCacheKey, JSON.stringify(officialList));
        }
    }
    
    // 2. Busca o conteúdo homebrew relevante.
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    const queryBuilder = homebrewRepo.createQueryBuilder('hb')
        .where('hb.type = :type', { type: normalizedResource });

    let userInstalledIds: string[] = [];
    if (userId) {
        const userRepo = AppDataSource.getRepository(User);
        const user = await userRepo.findOne({ where: { id: userId }, select: ['installedHomebrewIds'] });
        userInstalledIds = user?.installedHomebrewIds || [];
    }

    // A query agora busca conteúdo que seja público OU que esteja na lista de instalados do usuário.
    if (userInstalledIds.length > 0) {
         queryBuilder.andWhere('(hb.isPublic = :isPublic OR hb.id IN (:...userInstalledIds))', { 
            isPublic: true, 
            userInstalledIds: userInstalledIds 
        });
    } else {
        queryBuilder.andWhere('hb.isPublic = :isPublic', { isPublic: true });
    }
    
    const allRelevantHomebrew = await queryBuilder.getMany();
    
    // 3. Mescla as listas, dando prioridade ao Homebrew.
    const finalMap = new Map<string, any>();
    
    // Adiciona a base oficial primeiro
    officialList.forEach(item => finalMap.set(item.index, { ...item, source: 'official' }));

    // Sobrescreve e adiciona com o conteúdo homebrew
    allRelevantHomebrew.forEach(hb => {
        const content = hb.content as any;
        // Usa o official_index para sobrescrever, ou o ID do homebrew para conteúdo novo
        const finalIndex = content.official_index ? norm(content.official_index) : hb.id;
        
        finalMap.set(finalIndex, { 
            index: hb.id, // A URL do item sempre usará o ID do homebrew
            name: content.name, 
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

    // Identifica se estamos buscando por um UUID de homebrew ou por um índice oficial.
    const isUuid = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(normalizedIndex);

    let homebrewOverride: HomebrewContent | null = null;
    
    if (isUuid) {
        homebrewOverride = await homebrewRepo.findOneBy({ id: normalizedIndex });
    } else if (userId) {
        const userRepo = AppDataSource.getRepository(User);
        const user = await userRepo.findOne({ where: { id: userId }, select: ['installedHomebrewIds'] });
        const installedIds = user?.installedHomebrewIds || [];

        if (installedIds.length > 0) {
            homebrewOverride = await homebrewRepo.createQueryBuilder("hb")
                .where("hb.id IN (:...installedIds)", { installedIds })
                .andWhere("JSON_UNQUOTE(JSON_EXTRACT(hb.content, '$.official_index')) = :index", { index: normalizedIndex })
                .andWhere("hb.type = :type", { type: normalizedResource })
                .getOne();
        }
    }
    
    if (homebrewOverride) {
        if (!homebrewOverride.isPublic && homebrewOverride.authorId !== userId) {
            throw new Error('Acesso negado a este conteúdo privado.');
        }
        return homebrewOverride.content;
    }
    
    if (isUuid && !homebrewOverride) {
        throw new Error('Conteúdo Homebrew não encontrado.');
    }

    // Se não há override, busca o conteúdo oficial da API ou do cache.
    const cacheKey = `dnd5e-details:${normalizedResource}:${normalizedIndex}`;
    
    if (redisClient && redisClient.isOpen) {
        const cachedOfficial = await redisClient.get(cacheKey);
        if (cachedOfficial) {
            return JSON.parse(cachedOfficial);
        }
    }
    
    const officialData = await fetchDetails(normalizedResource, normalizedIndex);
    if (officialData && redisClient && redisClient.isOpen) {
        await redisClient.set(cacheKey, JSON.stringify(officialData));
    }

    if (!officialData) {
        // Tenta encontrar uma tradução de admin como último recurso
        const adminTranslation = await HomebrewService.findAdminTranslation(normalizedIndex, normalizedResource as HomebrewContentType);
        if(adminTranslation) {
            return adminTranslation.content;
        }
        throw new Error(`Recurso '${normalizedIndex}' em '${normalizedResource}' não encontrado.`);
    }

    return officialData;
}
