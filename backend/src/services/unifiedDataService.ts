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

// Mapa para traduzir nomes de recursos de URL para tipos de banco de dados
const TYPE_MAP: Record<string, string> = {
  equipment: 'item',
  races: 'race',
  classes: 'class',
  backgrounds: 'background',
  spells: 'spell',
  features: 'feat', // Mapeando 'features' para 'feat' como no exemplo
  feats: 'feat',
  languages: 'language',
  conditions: 'condition',
  'magic-items': 'item',
  monsters: 'monster',
  proficiencies: 'proficiency',
  subclasses: 'subclass',
  subraces: 'subrace',
  traits: 'trait',
};


// Função para buscar a lista de dados oficiais, com cache
async function getOfficialList(resource: string): Promise<any[]> {
    const listKey = `dnd5e:${resource}:list`;
    
    if (redisClient && redisClient.isOpen) {
        try {
            const cachedList = await redisClient.get(listKey);
            if (cachedList) {
                // console.log(`[UnifiedService] Cache HIT para lista pública: '${listKey}'`);
                return JSON.parse(cachedList);
            }
        } catch(e) { console.error(`[Cache] Erro ao ler lista do Redis: ${listKey}`, e)}
    }
    
    // console.log(`[UnifiedService] Cache MISS para lista pública: '${listKey}'. Buscando da API externa...`);
    const apiResponse = await getResourceList(resource);
    const officialList = apiResponse?.results || [];

    if (redisClient && redisClient.isOpen && officialList.length > 0) {
        try {
            await redisClient.set(listKey, JSON.stringify(officialList));
        } catch(e) { console.error(`[Cache] Erro ao salvar lista no Redis: ${listKey}`, e)}
    }
    
    return officialList;
}

// Função para buscar detalhes de um item, com cache
async function getOfficialDetails(resource: string, index: string): Promise<any> {
    const detailKey = KEY(resource, index);

    if (redisClient && redisClient.isOpen) {
        try {
            const cachedDetail = await redisClient.get(detailKey);
            if (cachedDetail) {
                // console.log(`[UnifiedService] Cache HIT para detalhe: '${detailKey}'`);
                return JSON.parse(cachedDetail);
            }
        } catch(e) { console.error(`[Cache] Erro ao ler detalhe do Redis: ${detailKey}`, e)}
    }

    // console.log(`[UnifiedService] Cache MISS para detalhe: '${detailKey}'. Buscando...`);
    const details = await getDetails(resource, index);

    if (redisClient && redisClient.isOpen && details) {
        try {
            await redisClient.set(detailKey, JSON.stringify(details));
        } catch(e) { console.error(`[Cache] Erro ao salvar detalhe no Redis: ${detailKey}`, e)}
    }

    return details;
}

export async function getUnifiedList(resource: string, userId?: number): Promise<any[]> {
    const normalizedResource = norm(resource);
    console.log(`[UnifiedService] Iniciando getUnifiedList para resource: '${normalizedResource}', userId: ${userId}`);

    const dbType = TYPE_MAP[normalizedResource] || normalizedResource;
    
    const officialListPromise = getOfficialList(normalizedResource);
    let allRelevantHomebrew: HomebrewContent[] = [];
    const homebrewRepo = repo();

    if (userId) {
        const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId }, select: ['installedHomebrewIds'] });
        const userInstalledIds = user?.installedHomebrewIds || [];
        console.log(`[UnifiedService] Encontrados ${userInstalledIds.length} IDs de homebrew instalados para o usuário ${userId}`);
        
        const qb = homebrewRepo.createQueryBuilder('hb');
        qb.where('hb.type = :type', { type: dbType })
          .andWhere(new Brackets(sqb => {
              sqb.where('hb.isPublic = :isPublic', { isPublic: true });
              if (userInstalledIds.length > 0) {
                  sqb.orWhere('hb.id IN (:...ids)', { ids: userInstalledIds });
              }
          }));
        
        console.log('[UnifiedService] SQL da Query Homebrew:', qb.getSql());
        allRelevantHomebrew = await qb.getMany();

    } else {
        // Se não houver usuário, busca apenas os públicos
        allRelevantHomebrew = await homebrewRepo.find({ where: { type: dbType as HomebrewContentType, isPublic: true }});
    }
    
    console.log(`[UnifiedService] Query de Homebrew retornou ${allRelevantHomebrew.length} itens (públicos + instalados pelo usuário).`);

    const officialList = await officialListPromise;
    console.log(`[UnifiedService] Mesclando ${officialList.length} itens oficiais com ${allRelevantHomebrew.length} itens homebrew.`);

    const finalMap = new Map<string, any>();
    
    officialList.forEach(item => {
        if (item && item.index) {
            finalMap.set(norm(item.index), { ...item, source: 'official', isHomebrew: false });
        }
    });

    let overwrittenCount = 0;
    let newCount = 0;

    allRelevantHomebrew.forEach(hb => {
        const content = typeof hb.content === 'string' ? JSON.parse(hb.content) : hb.content;
        if (!content) return;
        
        // Prioriza o official_index se existir, para sobrescrever conteúdo oficial
        const officialIndexToOverride = content.official_index ? norm(content.official_index) : null;
        // A chave primária para o mapa é o official_index ou, se não houver, o ID do próprio homebrew
        const key = officialIndexToOverride || hb.id;
        
        const isOverwriting = officialIndexToOverride && finalMap.has(officialIndexToOverride);
        if (isOverwriting) overwrittenCount++;
        else newCount++;
        
        const baseData = isOverwriting ? finalMap.get(officialIndexToOverride) : {};
        
        finalMap.set(key, { 
            ...baseData, 
            ...content,
            index: hb.id, // O índice real para busca de detalhes será sempre o ID do homebrew
            name: content.name || baseData.name,
            source: 'homebrew',
            isHomebrew: true,
            authorId: hb.authorId,
            url: `/api/data/${normalizedResource}/${hb.id}`,
        });
    });
    
    console.log(`[UnifiedService] Sobrescrevendo ${overwrittenCount} itens oficiais e adicionando ${newCount} novos itens homebrew.`);
    
    const mergedList = Array.from(finalMap.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    console.log(`[UnifiedService] Mesclagem concluída. Total de itens: ${mergedList.length}.`);
    return mergedList;
}

export async function getUnifiedDetails(resource: string, index: string, userId?: number): Promise<any> {
    const normalizedResource = norm(resource);
    const dbType = TYPE_MAP[normalizedResource] || normalizedResource;
    const normalizedIndex = norm(index);
    const homebrewRepo = repo();

    const isUuid = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(normalizedIndex);
    
    let homebrewOverride: HomebrewContent | null = null;
    
    if (isUuid) {
        homebrewOverride = await homebrewRepo.findOneBy({ id: normalizedIndex });
        if (homebrewOverride && !homebrewOverride.isPublic && homebrewOverride.authorId !== userId) {
             throw new Error('Acesso negado a este conteúdo homebrew privado.');
        }
    }
    
    const officialIndexToFetch = homebrewOverride 
        ? (homebrewOverride.content as any)?.official_index
        : (isUuid ? null : normalizedIndex);

    let officialData: any = null;
    if (officialIndexToFetch) {
        officialData = await getOfficialDetails(normalizedResource, officialIndexToFetch);
    }
    
    if (!isUuid && !homebrewOverride) {
        const qb = homebrewRepo.createQueryBuilder('hb');
        qb.where('LOWER(hb.type) = :type', { type: dbType })
          .andWhere('LOWER(JSON_EXTRACT(hb.content, "$.official_index")) = :officialIndex', { officialIndex: normalizedIndex });
        
        if (userId) {
            const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId }, select: ['installedHomebrewIds'] });
            const userInstalledIds = user?.installedHomebrewIds || [];
            qb.andWhere(new Brackets(sqb => {
                sqb.where('hb.isPublic = :isPublic', { isPublic: true })
                   .orWhere('hb.id IN (:...ids)', { ids: userInstalledIds });
            }));
        } else {
             qb.andWhere('hb.isPublic = :isPublic', { isPublic: true });
        }
        homebrewOverride = await qb.getOne();
    }

    if (homebrewOverride) {
        const content = typeof homebrewOverride.content === 'string' ? JSON.parse(homebrewOverride.content) : homebrewOverride.content;
        return { ...(officialData || {}), ...content, source: 'homebrew', isHomebrew: true, id: homebrewOverride.id };
    }
    
    if (officialData) {
        return { ...officialData, source: 'official', isHomebrew: false };
    }

    return null;
}
