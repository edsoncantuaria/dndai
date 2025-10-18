// backend/src/services/unifiedDataService.ts
import redisClient from '../database/redis-client.js';
import { AppDataSource } from '../database/data-source.js';
import { HomebrewContent, HomebrewContentType } from '../entities/HomebrewContent.js';
import { getResourceList as fetchResourceList, getDetails as fetchDetails } from './dndApiService.js';
import { User } from '../entities/User.js';
import { In, Brackets } from 'typeorm';

const norm = (s?: string) => (s ?? '').toLowerCase().trim();
const KEY = (r: string, i?: string) => (i ? `dnd5e:${r}:${i}` : `dnd5e:${r}:list`);

async function getPublicContent(resource: string): Promise<any[]> {
    const listKey = KEY(resource);
    const cachedList = redisClient.isOpen ? await redisClient.get(listKey) : null;

    if (cachedList) {
        console.log(`[UnifiedService] Cache HIT para lista pública: '${listKey}'`);
        return JSON.parse(cachedList);
    }

    console.log(`[UnifiedService] Cache MISS para lista pública: '${listKey}'. Buscando da API externa...`);
    const apiResponse = await fetchResourceList(resource);
    const officialList = apiResponse?.results || [];

    if (redisClient.isOpen && officialList.length > 0) {
        await redisClient.set(listKey, JSON.stringify(officialList));
    }

    return officialList;
}

export async function getUnifiedList(resource: string, userId?: number): Promise<any[]> {
    const normalizedResource = norm(resource);
    console.log(`[UnifiedService] Iniciando getUnifiedList para resource: '${normalizedResource}', userId: ${userId}`);

    const officialList = await getPublicContent(normalizedResource);
    let allRelevantHomebrew: HomebrewContent[] = [];
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);

    if (userId) {
        const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId }, select: ['installedHomebrewIds'] });
        const userInstalledIds = user?.installedHomebrewIds || [];
        console.log(`[UnifiedService] Encontrados ${userInstalledIds.length} IDs de homebrew instalados para o usuário ${userId}`);
        
        if (userInstalledIds.length > 0) {
            const queryBuilder = homebrewRepo.createQueryBuilder('hb')
                .where('LOWER(hb.type) = :type', { type: normalizedResource })
                .andWhere(new Brackets(qb => {
                    qb.where('hb.isPublic = :isPublic', { isPublic: true })
                      .orWhere('hb.id IN (:...ids)', { ids: userInstalledIds });
                }));

            console.log("[UnifiedService] SQL da Query Homebrew:", queryBuilder.getSql()); // LOG ADICIONADO
            allRelevantHomebrew = await queryBuilder.getMany();
        } else {
             allRelevantHomebrew = await homebrewRepo.find({
                where: {
                    type: normalizedResource as any,
                    isPublic: true
                }
            });
        }
    } else {
        allRelevantHomebrew = await homebrewRepo.find({
            where: { type: normalizedResource as any, isPublic: true }
        });
    }

    console.log(`[UnifiedService] Query de Homebrew retornou ${allRelevantHomebrew.length} itens (públicos + instalados pelo usuário).`);
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
    const homebrewRepo = AppDataSource.getRepository(HomebrewContent);

    const isUuid = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(normalizedIndex);
    let homebrewOverride: HomebrewContent | null = null;
    
    if (isUuid) {
        homebrewOverride = await homebrewRepo.findOneBy({ id: normalizedIndex });
    }

    const officialIndexToFetch = homebrewOverride 
        ? (homebrewOverride.content as any)?.official_index
        : (isUuid ? null : normalizedIndex);

    let officialData: any = null;
    if (officialIndexToFetch) {
        officialData = await fetchDetails(normalizedResource, officialIndexToFetch);
    }
    
    if (!homebrewOverride && userId) {
        const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId }, select: ['installedHomebrewIds'] });
        if (user?.installedHomebrewIds?.length) {
            homebrewOverride = await homebrewRepo.createQueryBuilder("hb")
                .where("LOWER(hb.type) = :type", { type: normalizedResource })
                .andWhere("JSON_UNQUOTE(JSON_EXTRACT(hb.content, '$.official_index')) = :officialIndex", { officialIndex: normalizedIndex })
                .andWhere("hb.id IN (:...ids)", { ids: user.installedHomebrewIds })
                .getOne();
        }
    }

    if (homebrewOverride) {
        if (!homebrewOverride.isPublic && homebrewOverride.authorId !== userId) {
            throw new Error('Acesso negado a este conteúdo privado.');
        }
        return { ...(officialData || {}), ...homebrewOverride.content, source: 'homebrew', isHomebrew: true, id: homebrewOverride.id };
    }
    
    if (officialData) {
        return { ...officialData, source: 'official', isHomebrew: false };
    }

    return null;
}
