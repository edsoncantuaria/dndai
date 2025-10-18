// backend/src/services/unifiedDataService.ts
import redisClient from '../database/redis-client.js';
import { AppDataSource } from '../database/data-source.js';
import { HomebrewContent, HomebrewContentType } from '../entities/HomebrewContent.js';
import { getResourceList, getDetails } from './dndApiService.js';
import { User } from '../entities/User.js';
import { In, FindOptionsWhere, Brackets } from 'typeorm';

const repo = () => AppDataSource.getRepository(HomebrewContent);
const norm = (s?: string) => (s ?? '').toLowerCase().trim();
const KEY = (r: string, i?: string) => (i ? `dnd5e:${r}:${i}` : `dnd5e:${r}:list`);
const CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 horas

// Função para buscar a lista de dados oficiais, com cache
async function getOfficialList(resource: string): Promise<any[]> {
    const listKey = KEY(resource, 'list');
    
    if (redisClient && redisClient.isOpen) {
        const cachedList = await redisClient.get(listKey);
        if (cachedList) {
            console.log(`[UnifiedService] Cache HIT para lista pública: '${listKey}'`);
            return JSON.parse(cachedList);
        }
    }
    
    console.log(`[UnifiedService] Cache MISS para lista pública: '${listKey}'. Buscando da API externa...`);
    const apiResponse = await getResourceList(resource);
    const officialList = apiResponse?.results || [];

    if (redisClient && redisClient.isOpen && officialList.length > 0) {
        await redisClient.set(listKey, JSON.stringify(officialList));
    }
    
    return officialList;
}

// Função para buscar detalhes de um item, com cache
async function getOfficialDetails(resource: string, index: string): Promise<any> {
    const detailKey = KEY(resource, index);

    if (redisClient && redisClient.isOpen) {
        const cachedDetail = await redisClient.get(detailKey);
        if (cachedDetail) {
            // console.log(`[UnifiedService] Cache HIT para detalhe: '${detailKey}'`);
            return JSON.parse(cachedDetail);
        }
    }

    // console.log(`[UnifiedService] Cache MISS para detalhe: '${detailKey}'. Buscando...`);
    const details = await getDetails(resource, index);

    if (redisClient && redisClient.isOpen && details) {
        await redisClient.set(detailKey, JSON.stringify(details));
    }

    return details;
}

export async function getUnifiedList(resource: string, userId?: number): Promise<any[]> {
    const normalizedResource = norm(resource);
    console.log(`[UnifiedService] Iniciando getUnifiedList para resource: '${normalizedResource}', userId: ${userId}`);

    const officialListPromise = getOfficialList(normalizedResource);
    let allRelevantHomebrew: HomebrewContent[] = [];
    const homebrewRepo = repo();

    if (userId) {
        const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId }, select: ['installedHomebrewIds'] });
        const userInstalledIds = user?.installedHomebrewIds || [];
        console.log(`[UnifiedService] Encontrados ${userInstalledIds.length} IDs de homebrew instalados para o usuário ${userId}`);
        
        if (userInstalledIds.length > 0) {
            allRelevantHomebrew = await homebrewRepo.find({
                where: {
                    type: normalizedResource as HomebrewContentType,
                    id: In(userInstalledIds)
                }
            });
        }
    }

    // Adiciona homebrew público que ainda não foi adicionado
    const publicHomebrew = await homebrewRepo.find({ where: { type: normalizedResource as HomebrewContentType, isPublic: true }});
    const homebrewMap = new Map<string, HomebrewContent>();
    allRelevantHomebrew.forEach(hb => homebrewMap.set(hb.id, hb));
    publicHomebrew.forEach(hb => homebrewMap.set(hb.id, hb));
    allRelevantHomebrew = Array.from(homebrewMap.values());
    
    console.log(`[UnifiedService] Query de Homebrew retornou ${allRelevantHomebrew.length} itens (públicos + instalados pelo usuário).`);

    const officialList = await officialListPromise;
    console.log(`[UnifiedService] Mesclando ${officialList.length} itens oficiais com ${allRelevantHomebrew.length} itens homebrew.`);

    const finalMap = new Map<string, any>();
    
    officialList.forEach(item => {
        if (item && item.index) {
            finalMap.set(norm(item.index), { ...item, source: 'official', isHomebrew: false });
        }
    });

    allRelevantHomebrew.forEach(hb => {
        const content = hb.content as any;
        if (!content) return;

        const officialIndexToOverride = content.official_index ? norm(content.official_index) : null;
        const key = officialIndexToOverride || hb.id;
        
        const baseData = officialIndexToOverride ? finalMap.get(officialIndexToOverride) || {} : {};
        const mergedData = { ...baseData, ...content };

        finalMap.set(key, { 
            ...mergedData,
            index: hb.id,
            source: 'homebrew',
            isHomebrew: true,
            url: `/api/data/${normalizedResource}/${hb.id}`,
        });
    });
    
    const mergedList = Array.from(finalMap.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    console.log(`[UnifiedService] Mesclagem concluída. Total de itens: ${mergedList.length}.`);
    return mergedList;
}

export async function getUnifiedDetails(resource: string, index: string, userId?: number): Promise<any> {
    const normalizedResource = norm(resource);
    const normalizedIndex = norm(index);
    const homebrewRepo = repo();

    const isUuid = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(normalizedIndex);
    
    let homebrewOverride: HomebrewContent | null = null;
    
    // Se for um UUID, é um item homebrew por definição.
    if (isUuid) {
        homebrewOverride = await homebrewRepo.findOneBy({ id: normalizedIndex });
        if (homebrewOverride && !homebrewOverride.isPublic && homebrewOverride.authorId !== userId) {
             throw new Error('Acesso negado a este conteúdo homebrew privado.');
        }
    }
    
    // Se não for UUID, pode ser um item oficial ou um homebrew que sobrescreve um oficial.
    const officialIndexToFetch = homebrewOverride 
        ? (homebrewOverride.content as any)?.official_index
        : (isUuid ? null : normalizedIndex);

    let officialData: any = null;
    if (officialIndexToFetch) {
        officialData = await getOfficialDetails(normalizedResource, officialIndexToFetch);
    }
    
    // Se não encontramos um homebrew pelo UUID, verificamos se há um homebrew instalado que sobrescreve o índice oficial.
    if (!homebrewOverride && userId && officialIndexToFetch) {
        const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId }, select: ['installedHomebrewIds'] });
        if (user?.installedHomebrewIds?.length) {
            homebrewOverride = await homebrewRepo.findOne({
                where: {
                    type: normalizedResource as HomebrewContentType,
                    id: In(user.installedHomebrewIds),
                    content: { official_index: officialIndexToFetch } as any
                }
            });
        }
    }

    if (homebrewOverride) {
        return { ...(officialData || {}), ...homebrewOverride.content, source: 'homebrew', isHomebrew: true, id: homebrewOverride.id };
    }
    
    if (officialData) {
        return { ...officialData, source: 'official', isHomebrew: false };
    }

    return null;
}
