// backend/src/services/unifiedDataService.ts
import redisClient from '../database/redis-client.js';
import { AppDataSource } from '../database/data-source.js';
import { HomebrewContent } from '../entities/HomebrewContent.js';
import { getResourceList as fetchResourceList, getDetails as fetchDetails } from './dndApiService.js';
import { User } from '../entities/User.js';
import { In, Brackets } from 'typeorm';

const norm = (s?: string) => (s ?? '').toLowerCase().trim();
const KEY = (r: string, i?: string) => (i ? `dnd5e:${r}:${i}` : `dnd5e:${r}:list`);

export async function getUnifiedList(resource: string, userId?: number): Promise<any[]> {
    const normalizedResource = norm(resource);
    console.log(`[UnifiedService] Iniciando getUnifiedList para resource: '${normalizedResource}', userId: ${userId}`);

    // 1. Busca dados oficiais (cache ou API)
    const officialListKey = KEY(normalizedResource);
    let officialList: { index: string; name: string; url: string }[] = [];
    const cachedOfficialList = redisClient.isOpen ? await redisClient.get(officialListKey) : null;

    if (cachedOfficialList) {
        console.log(`[UnifiedService] Cache HIT para lista pública: '${officialListKey}'`);
        officialList = JSON.parse(cachedOfficialList);
    } else {
        console.log(`[UnifiedService] Cache MISS para lista pública: '${officialListKey}'. Buscando da API externa...`);
        const apiResponse = await fetchResourceList(normalizedResource);
        officialList = apiResponse?.results || [];
        if (redisClient.isOpen && officialList.length > 0) {
            await redisClient.set(officialListKey, JSON.stringify(officialList));
        }
    }

    // 2. Busca conteúdo Homebrew (Público + Instalado pelo Usuário)
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
                      .orWhere('hb.id IN (:...userInstalledIds)', { userInstalledIds });
                }));
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
        // Para usuários anônimos, busca apenas o conteúdo público
        allRelevantHomebrew = await homebrewRepo.find({
            where: {
                type: normalizedResource as any,
                isPublic: true
            }
        });
    }
     console.log(`[UnifiedService] Query de Homebrew retornou ${allRelevantHomebrew.length} itens (públicos + instalados pelo usuário).`);

    
    // 3. Mescla as listas
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

        const officialIndex = content.official_index ? norm(content.official_index) : null;
        const key = officialIndex || hb.id;
        
        let mergedData = { ...(officialIndex ? finalMap.get(key) || {} : {}), ...content };

        finalMap.set(key, { 
            index: hb.id, 
            name: mergedData.name || finalMap.get(key)?.name,
            url: `/api/data/${normalizedResource}/${hb.id}`,
            source: 'homebrew',
            isHomebrew: true,
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
    console.log(`[UnifiedService] Iniciando getUnifiedDetails para resource: '${normalizedResource}', index: '${normalizedIndex}', userId: ${userId}`);

    const isUuid = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(normalizedIndex);

    let homebrewOverride: HomebrewContent | null = null;
    let officialIndexToFetch = isUuid ? '' : normalizedIndex;

    // Se o índice é um UUID, é definitivamente um homebrew.
    if (isUuid) {
        homebrewOverride = await homebrewRepo.findOneBy({ id: normalizedIndex });
        if (homebrewOverride) {
            officialIndexToFetch = (homebrewOverride.content as any)?.official_index || '';
        } else {
            throw new Error(`Conteúdo Homebrew com ID '${normalizedIndex}' não encontrado.`);
        }
    } else {
         // Se não for UUID, busca por um homebrew que possa estar sobrescrevendo o índice oficial.
        const user = userId ? await AppDataSource.getRepository(User).findOne({ where: { id: userId }, select: ['installedHomebrewIds'] }) : null;
        const installedIds = user?.installedHomebrewIds || [];

        if (installedIds.length > 0) {
            const queryBuilder = homebrewRepo.createQueryBuilder("hb")
                .where("LOWER(hb.type) = :type", { type: normalizedResource })
                .andWhere("hb.id IN (:...installedIds)", { installedIds });

            // Precisamos buscar por `official_index` no JSON
            const potentialOverrides = await queryBuilder.getMany();
            homebrewOverride = potentialOverrides.find(hb => (hb.content as any)?.official_index === officialIndexToFetch) || null;
        }
    }

    // Busca o dado oficial da API ou do cache, se houver um índice oficial para buscar.
    let officialData: any = null;
    if (officialIndexToFetch) {
        const cacheKey = KEY(normalizedResource, officialIndexToFetch);
        const cachedOfficial = redisClient.isOpen ? await redisClient.get(cacheKey) : null;
        if (cachedOfficial) {
            officialData = JSON.parse(cachedOfficial);
        } else {
            officialData = await fetchDetails(normalizedResource, officialIndexToFetch);
            if (officialData && redisClient.isOpen) {
                await redisClient.set(cacheKey, JSON.stringify(officialData));
            }
        }
    }
    
    // Prioriza o Homebrew. Se ele existir, mescla com o oficial. Se não, retorna o oficial. Se nenhum existir, retorna erro.
    if (homebrewOverride) {
        if (!homebrewOverride.isPublic && homebrewOverride.authorId !== userId) {
            throw new Error('Acesso negado a este conteúdo privado.');
        }
         // Se o homebrew sobrescreve um oficial, mescla os dois.
        if (officialData) {
            console.log(`[UnifiedService] Mesclando dados oficiais com o Homebrew '${homebrewOverride.name}'.`);
            return { ...officialData, ...homebrewOverride.content, source: 'homebrew' };
        }
        // Se é um homebrew "puro" (sem oficial_index), retorna ele diretamente.
        return { ...homebrewOverride.content, source: 'homebrew' };
    }
    
    if (officialData) {
        console.log(`[UnifiedService] Retornando apenas dados oficiais.`);
        return { ...officialData, source: 'official' };
    }

    throw new Error(`Recurso '${normalizedIndex}' em '${normalizedResource}' não encontrado em nenhuma fonte.`);
}
