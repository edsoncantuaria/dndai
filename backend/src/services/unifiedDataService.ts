// backend/src/services/unifiedDataService.ts
import redisClient from '../database/redis-client.js';
import { AppDataSource } from '../database/data-source.js';
import { HomebrewContent, HomebrewContentType } from '../entities/HomebrewContent.js';
import { getResourceList, getDetails } from './dndApiService.js';
import { User } from '../entities/User.js';
import { In, Brackets } from 'typeorm';

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
                return JSON.parse(cachedList);
            }
        } catch(e) { console.error(`[Cache] Erro ao ler lista do Redis: ${listKey}`, e)}
    }
    
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
                return JSON.parse(cachedDetail);
            }
        } catch(e) { console.error(`[Cache] Erro ao ler detalhe do Redis: ${detailKey}`, e)}
    }

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
        
        if (userInstalledIds.length > 0) {
            const qb = homebrewRepo.createQueryBuilder('hb')
                .where('LOWER(hb.type) = :type', { type: dbType })
                .andWhere(new Brackets(sqb => {
                    sqb.where('hb.isPublic = :isPublic', { isPublic: true });
                    if (userInstalledIds.length > 0) {
                      sqb.orWhere('hb.id IN (:...ids)', { ids: userInstalledIds });
                      sqb.orWhere('hb.bundleId IN (:...ids)', { ids: userInstalledIds });
                    }
                }));

            console.log('[UnifiedService] SQL da Query Homebrew:', qb.getSql());
            allRelevantHomebrew = await qb.getMany();
        } else {
             allRelevantHomebrew = await homebrewRepo.find({
                where: { type: dbType as HomebrewContentType, isPublic: true }
             });
        }
    } else {
        allRelevantHomebrew = await homebrewRepo.find({ where: { type: dbType as HomebrewContentType, isPublic: true }});
    }
    
    console.log(`[UnifiedService] Query de Homebrew retornou ${allRelevantHomebrew.length} itens (públicos + instalados).`);

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
        
        const officialIndexToOverride = norm(content.official_index || content.index || '');
        if (officialIndexToOverride && finalMap.has(officialIndexToOverride)) {
            const base = finalMap.get(officialIndexToOverride);
            finalMap.set(officialIndexToOverride, {
                ...base,
                ...content,
                index: base.index, // mantém o index oficial na lista
                source: 'homebrew',
                isHomebrew: true,
                homebrewId: hb.id, // expõe UUID separadamente
                authorId: hb.authorId,
                url: `/api/data/${normalizedResource}/${base.index}`, // detalhe por index oficial
            });
            overwrittenCount++;
        } else {
            const newIdx = norm(content.index || hb.id);
            if (!finalMap.has(newIdx)) { // Evita duplicatas se um item novo já foi adicionado
                finalMap.set(newIdx, {
                    ...content,
                    index: content.index || hb.id, // se não tiver index, usa UUID
                    source: 'homebrew',
                    isHomebrew: true,
                    homebrewId: hb.id,
                    authorId: hb.authorId,
                    url: `/api/data/${normalizedResource}/${content.index || hb.id}`, // detalhe por index (ou UUID)
                });
                newCount++;
            }
        }
    });
    
    console.log(`[UnifiedService] Sobrescrevendo ${overwrittenCount} oficiais e adicionando ${newCount} novos homebrew.`);
    
    const mergedList = Array.from(finalMap.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    console.log(`[UnifiedService] Mesclagem concluída. Total de itens: ${mergedList.length}.`);
    return mergedList;
}

export async function getUnifiedDetails(resource: string, index: string, userId?: number): Promise<any> {
  const normalizedResource = norm(resource);
  const dbType = TYPE_MAP[normalizedResource] || normalizedResource;
  const normalizedIndex = norm(index);
  const homebrewRepo = repo();
  const isUuid = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(index);

  let officialData: any = null;
  let hb: HomebrewContent | null = null;

  // 1) se veio UUID, pega o conteúdo homebrew direto
  if (isUuid) {
    hb = await homebrewRepo.findOne({ where: { id: index } });
    if (!hb) return null;
    if (!hb.isPublic && hb.authorId !== userId) throw new Error('Acesso negado a este conteúdo homebrew privado.');

    const content = typeof hb.content === 'string' ? JSON.parse(hb.content) : hb.content;
    const officialIndex = norm(content?.official_index || content?.index || '');

    if (officialIndex) {
      try { officialData = await getOfficialDetails(normalizedResource, officialIndex); } catch {}
    }
    return { ...(officialData || {}), ...content, source: 'homebrew', isHomebrew: true, id: hb.id };
  }

  // 2) veio por index oficial → puxa oficial do cache/API
  try { officialData = await getOfficialDetails(normalizedResource, normalizedIndex); } catch {}

  // 3) procurar overlay homebrew por index (official_index OU index)
  const qb = homebrewRepo.createQueryBuilder('hb')
    .where('LOWER(hb.type) = :type', { type: norm(dbType) })
    .andWhere(new Brackets((sqb) => {
      // official_index == :index OR index == :index
      sqb.where('LOWER(JSON_UNQUOTE(JSON_EXTRACT(hb.content, "$.official_index"))) = :idx', { idx: normalizedIndex })
         .orWhere('LOWER(JSON_UNQUOTE(JSON_EXTRACT(hb.content, "$.index"))) = :idx', { idx: normalizedIndex });
    }));

  if (userId) {
    const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId }, select: ['installedHomebrewIds'] });
    const userInstalledIds = user?.installedHomebrewIds || [];
    if (userInstalledIds.length > 0) {
      qb.andWhere(new Brackets((sqb) => {
        sqb.where('hb.isPublic = :isPublic', { isPublic: true })
           .orWhere('hb.id IN (:...ids)', { ids: userInstalledIds })
           .orWhere('hb.bundleId IN (:...ids)', { ids: userInstalledIds });
      }));
    } else {
        qb.andWhere('hb.isPublic = :isPublic', { isPublic: true });
    }
  } else {
    qb.andWhere('hb.isPublic = :isPublic', { isPublic: true });
  }

  hb = await qb.getOne();

  if (hb) {
    const content = typeof hb.content === 'string' ? JSON.parse(hb.content) : hb.content;
    return { ...(officialData || {}), ...content, source: 'homebrew', isHomebrew: true, id: hb.id };
  }

  if (officialData) return { ...officialData, source: 'official', isHomebrew: false };
  return null;
}
