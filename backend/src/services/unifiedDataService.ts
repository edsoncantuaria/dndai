// backend/src/services/unifiedDataService.ts
import redisClient from '../database/redis-client.js';
import { AppDataSource } from '../database/data-source.js';
import { HomebrewContent } from '../entities/HomebrewContent.js';
import { getResourceList as fetchResourceList, getDetails as fetchDetails } from './dndApiService.js';
import { User } from '../entities/User.js';
import { In, Not } from 'typeorm';


const norm = (s?: string) => (s ?? '').toLowerCase().trim().replace(/\s+/g, '-');

/**
 * Retorna uma lista de recursos (ex: 'races'), unindo dados oficiais, públicos e do usuário.
 */
export async function getUnifiedList(resource: string, userId?: number): Promise<any[]> {
    const normalizedResource = norm(resource);
    console.log(`[UnifiedService] Iniciando getUnifiedList para resource: '${normalizedResource}', userId: ${userId}`);

    // 1. Busca a lista de base oficial da API (ou do cache compartilhado).
    const publicCacheKey = `dnd5e:${normalizedResource}:list`;
    let officialList: { index: string; name: string; url: string }[] = [];
    
    if (redisClient && redisClient.isOpen) {
        const cachedPublicList = await redisClient.get(publicCacheKey);
        if (cachedPublicList) {
            console.log(`[UnifiedService] Cache HIT para lista pública: '${publicCacheKey}'`);
            officialList = JSON.parse(cachedPublicList);
        }
    }
    
    if (officialList.length === 0) {
        console.log(`[UnifiedService] Cache MISS para lista pública: '${publicCacheKey}'. Buscando da API externa...`);
        const apiResponse = await fetchResourceList(normalizedResource);
        officialList = apiResponse?.results || [];
        if (redisClient && redisClient.isOpen && officialList.length > 0) {
            console.log(`[UnifiedService] Salvando lista pública no cache: '${publicCacheKey}'`);
            await redisClient.set(publicCacheKey, JSON.stringify(officialList)); // Persistente
        }
    }
    
    // 2. Busca o conteúdo homebrew relevante.
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    const queryBuilder = homebrewRepo.createQueryBuilder('hb')
        .where('LOWER(hb.type) = :type', { type: normalizedResource });

    let userInstalledIds: string[] = [];
    if (userId) {
        const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId }, select: ['installedHomebrewIds'] });
        userInstalledIds = user?.installedHomebrewIds || [];
        console.log(`[UnifiedService] Encontrados ${userInstalledIds.length} IDs de homebrew instalados para o usuário ${userId}`);
    }

    // A query agora busca conteúdo que seja público OU que esteja na lista de instalados do usuário.
    const whereClauses = ['hb.isPublic = :isPublic'];
    const whereParams: any = { isPublic: true, type: normalizedResource };

    if (userInstalledIds.length > 0) {
        whereClauses.push('hb.id IN (:...userInstalledIds)');
        whereParams.userInstalledIds = userInstalledIds;
    }
    
    queryBuilder.where(`(${whereClauses.join(' OR ')}) AND LOWER(hb.type) = :type`, whereParams);

    const allRelevantHomebrew = await queryBuilder.getMany();
    console.log(`[UnifiedService] Query de Homebrew retornou ${allRelevantHomebrew.length} itens (públicos + instalados pelo usuário).`);
    
    // 3. Mescla as listas, dando prioridade ao Homebrew.
    console.log(`[UnifiedService] Mesclando ${officialList.length} itens oficiais com ${allRelevantHomebrew.length} itens homebrew.`);
    const finalMap = new Map<string, any>();
    
    // Adiciona oficiais primeiro
    officialList.forEach(item => {
        if(item && item.index) {
            finalMap.set(norm(item.index), { ...item, source: 'official', isHomebrew: false });
        }
    });

    // Sobrescreve com homebrew
    allRelevantHomebrew.forEach(hb => {
        const content = hb.content as any;
        if (!content) return;
        
        const key = content.official_index ? norm(content.official_index) : hb.id;
        
        finalMap.set(key, { 
            index: hb.id, // O ID do frontend será sempre o do Homebrew para garantir a busca correta dos detalhes
            name: content.name || finalMap.get(key)?.name, // Usa o nome do homebrew, ou fallback para o oficial se não houver
            url: `/api/data/${normalizedResource}/${hb.id}`, 
            source: 'homebrew',
            isHomebrew: true,
        });
    });

    const mergedList = Array.from(finalMap.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    console.log(`[UnifiedService] Mesclagem concluída. Total de itens: ${mergedList.length}.`);

    return mergedList;
}


/**
 * Retorna os detalhes de um recurso específico, aplicando a lógica de prioridade.
 */
export async function getUnifiedDetails(resource: string, index: string, userId?: number): Promise<any> {
    const normalizedResource = norm(resource);
    const normalizedIndex = norm(index);
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
    console.log(`[UnifiedService] Iniciando getUnifiedDetails para resource: '${normalizedResource}', index: '${normalizedIndex}', userId: ${userId}`);

    const isUuid = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(normalizedIndex);

    let homebrewOverride: HomebrewContent | null = null;
    let officialIndexToFetch = normalizedIndex;

    if (isUuid) {
        console.log(`[UnifiedService] Index '${normalizedIndex}' é um UUID. Buscando diretamente como Homebrew.`);
        homebrewOverride = await homebrewRepo.findOneBy({ id: normalizedIndex });
        if (homebrewOverride) {
            const officialIndexFromContent = (homebrewOverride.content as any)?.official_index;
            if (officialIndexFromContent) {
                officialIndexToFetch = norm(officialIndexFromContent);
                console.log(`[UnifiedService] Homebrew encontrado. Ele sobrescreve o índice oficial: '${officialIndexToFetch}'.`);
            } else {
                console.log(`[UnifiedService] Homebrew puro encontrado. Retornando diretamente.`);
                if (!homebrewOverride.isPublic && homebrewOverride.authorId !== userId) {
                    throw new Error('Acesso negado a este conteúdo privado.');
                }
                return homebrewOverride.content;
            }
        } else {
            throw new Error(`Conteúdo Homebrew com ID '${normalizedIndex}' não encontrado.`);
        }
    } else {
        // Se não for UUID, busca por um homebrew que possa estar sobrescrevendo o índice oficial.
        const user = userId ? await AppDataSource.getRepository(User).findOne({ where: { id: userId }, select: ['installedHomebrewIds'] }) : null;
        const installedIds = user?.installedHomebrewIds || [];

        if (installedIds.length > 0) {
            homebrewOverride = await homebrewRepo.createQueryBuilder("hb")
                .where("LOWER(hb.type) = :type", { type: normalizedResource })
                .andWhere("hb.id IN (:...installedIds)", { installedIds })
                .andWhere("JSON_UNQUOTE(JSON_EXTRACT(hb.content, '$.official_index')) = :index", { index: officialIndexToFetch })
                .getOne();
             if(homebrewOverride) console.log(`[UnifiedService] Encontrado Homebrew instalado pelo usuário que sobrescreve o índice oficial '${officialIndexToFetch}'.`);
        }
    }

    // Busca o dado oficial da API ou do cache.
    const cacheKey = `dnd5e-details:${normalizedResource}:${officialIndexToFetch}`;
    let officialData: any = null;
    
    if (redisClient && redisClient.isOpen) {
        const cachedOfficial = await redisClient.get(cacheKey);
        if (cachedOfficial) {
            console.log(`[UnifiedService] Cache HIT para detalhes de '${cacheKey}'`);
            officialData = JSON.parse(cachedOfficial);
        }
    }
    
    if (!officialData) {
        console.log(`[UnifiedService] Cache MISS para detalhes de '${cacheKey}'. Buscando da API externa...`);
        officialData = await fetchDetails(normalizedResource, officialIndexToFetch);
        if (officialData && redisClient && redisClient.isOpen) {
            console.log(`[UnifiedService] Salvando detalhes no cache: '${cacheKey}'`);
            await redisClient.set(cacheKey, JSON.stringify(officialData)); // Persistente
        }
    }

    if (!officialData) {
        if (homebrewOverride) {
            console.log(`[UnifiedService] Recurso oficial não encontrado, mas existe um Homebrew. Retornando Homebrew.`);
            return homebrewOverride.content;
        }
        throw new Error(`Recurso '${normalizedIndex}' em '${normalizedResource}' não encontrado em nenhuma fonte.`);
    }

    if (homebrewOverride) {
        console.log(`[UnifiedService] Mesclando dados oficiais com o Homebrew '${homebrewOverride.name}'.`);
        // Merge profundo simples (pode ser melhorado se necessário)
        return { ...officialData, ...homebrewOverride.content, source: 'homebrew' };
    }

    console.log(`[UnifiedService] Retornando apenas dados oficiais.`);
    return { ...officialData, source: 'official' };
}
