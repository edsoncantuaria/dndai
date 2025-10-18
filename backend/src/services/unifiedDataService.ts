// backend/src/services/unifiedDataService.ts
import redisClient from '../database/redis-client.js';
import { AppDataSource } from '../database/data-source.js';
import { HomebrewContent, HomebrewContentType } from '../entities/HomebrewContent.js';
import { getResourceList as getOfficialResourceList, getDetails as getOfficialDetails } from './dndApiService.js';
import { User } from '../entities/User.js';
import { In, Brackets } from 'typeorm';
import createError from 'http-errors';
import { HomebrewBundle } from '../entities/HomebrewBundle.js';

const repo = () => AppDataSource.getRepository(HomebrewContent);
const norm = (s?: string) => (s ?? '').toLowerCase().trim();

const TYPE_MAP: Record<string, HomebrewContentType> = {
  equipment: 'item',
  races: 'race',
  classes: 'class',
  backgrounds: 'background',
  spells: 'spell',
  features: 'feat',
  feats: 'feat',
  languages: 'language',
  conditions: 'condition',
  'magic-items': 'item',
  monsters: 'monster',
  proficiencies: 'proficiency',
  subclasses: 'subclass',
  subraces: 'subrace',
  traits: 'trait',
  translations: 'translation',
};

const getOfficialList = async (resource: string): Promise<any[]> => {
  const listKey = `dnd5e:${resource}:list`;
  if (redisClient && redisClient.isOpen) {
    try {
      const cachedList = await redisClient.get(listKey);
      if (cachedList) return JSON.parse(cachedList);
    } catch (e) { console.error(`[Cache] Erro ao ler lista do Redis: ${listKey}`, e); }
  }
  const apiResponse = await getOfficialResourceList(resource);
  const officialList = apiResponse?.results || [];
  if (redisClient && redisClient.isOpen && officialList.length > 0) {
    await redisClient.set(listKey, JSON.stringify(officialList));
  }
  return officialList;
}

const applyTranslation = (item: any, translations: Record<string, any>) => {
    if (!item || !item.index) return item;
    const key = item.official_index || item.index;
    const translationData = translations[key];
    if (translationData) {
        return { ...item, ...translationData, name: translationData.name || item.name };
    }
    return item;
};


export async function getUnifiedList(resource: string, userId?: number): Promise<any[]> {
    console.log(`[UnifiedService] Iniciando getUnifiedList para resource: '${resource}', userId: ${userId}`);
    const dbType = TYPE_MAP[resource] || resource;

    const officialListPromise = getOfficialList(resource);
    
    const homebrewRepo = repo();
    let allRelevantHomebrew: HomebrewContent[] = [];

    if (userId) {
        const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId }, select: ['installedHomebrewIds'] });
        const installedIds = user?.installedHomebrewIds || [];
        console.log(`[UnifiedService] Encontrados ${installedIds.length} IDs de homebrew instalados para o usuário ${userId}`);
        
        if (installedIds.length > 0) {
            // Expand bundle IDs into content IDs
            const bundles = await AppDataSource.getRepository(HomebrewBundle).find({
                where: { id: In(installedIds) },
                relations: ['contents'],
            });
            const contentIdsFromBundles = bundles.flatMap(b => b.contents.map(c => c.id));
            const allContentIds = [...new Set([...installedIds, ...contentIdsFromBundles])];

            if (allContentIds.length > 0) {
                const qb = homebrewRepo.createQueryBuilder('hb')
                    .where('hb.isPublic = :isPublic', { isPublic: true })
                    .orWhere('hb.id IN (:...ids)', { ids: allContentIds });
                
                console.log('[UnifiedService] SQL da Query Homebrew (parcial):', qb.getSql());
                allRelevantHomebrew = await qb.getMany();
            }
        }
    }
    
    if (allRelevantHomebrew.length === 0) {
       allRelevantHomebrew = await homebrewRepo.find({
            where: { isPublic: true }
       });
    }

    const homebrewForType = allRelevantHomebrew.filter(hb => hb.type === dbType);
    const translations = allRelevantHomebrew.filter(hb => hb.type === 'translation');

    console.log(`[UnifiedService] Query de Homebrew retornou ${homebrewForType.length} itens do tipo '${dbType}' e ${translations.length} itens de tradução.`);
    
    const translationMap = translations.reduce((acc, curr) => {
        if(curr.content) {
            Object.assign(acc, curr.content);
        }
        return acc;
    }, {} as Record<string, any>);

    const officialList = (await officialListPromise).map(item => applyTranslation(item, translationMap));
    
    const finalMap = new Map<string, any>();
    officialList.forEach((item) => {
        if (item?.index) {
            finalMap.set(norm(item.index), { ...item, source: 'official', isHomebrew: false });
        }
    });

    let overwrittenCount = 0;
    let newCount = 0;

    for (const hb of homebrewForType) {
        const content = typeof hb.content === 'string' ? JSON.parse(hb.content) : hb.content;
        if (!content) continue;

        const officialIndexToOverride = norm(content.official_index || content.index);

        if (finalMap.has(officialIndexToOverride)) {
            const base = finalMap.get(officialIndexToOverride);
            const translatedBase = applyTranslation(base, translationMap);
            finalMap.set(officialIndexToOverride, {
                ...translatedBase,
                ...content,
                name: content.name || translatedBase.name, // Homebrew name takes priority
                index: base.index,
                source: 'homebrew',
                isHomebrew: true,
                homebrewId: hb.id,
                authorId: hb.authorId,
                url: `/api/data/${resource}/${base.index}`,
            });
            overwrittenCount++;
        } else {
            const newIdx = norm(content.index || hb.id);
            finalMap.set(newIdx, {
                ...content,
                index: content.index || hb.id,
                source: 'homebrew',
                isHomebrew: true,
                homebrewId: hb.id,
                authorId: hb.authorId,
                url: `/api/data/${resource}/${content.index || hb.id}`,
            });
            newCount++;
        }
    }

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
    
    const user = userId ? await AppDataSource.getRepository(User).findOne({ where: { id: userId }, select: ['installedHomebrewIds'] }) : null;
    const userInstalledIds = user?.installedHomebrewIds || [];

    if (isUuid) {
        hb = await homebrewRepo.findOneBy({ id: index });
        if (!hb) return null;
        if (!hb.isPublic && hb.authorId !== userId) {
            throw createError(403, 'Acesso negado a este conteúdo homebrew privado.');
        }

        const content = typeof hb.content === 'string' ? JSON.parse(hb.content) : hb.content;
        const officialIndexToFetch = norm(content?.official_index || content?.index);
        if (officialIndexToFetch) {
            try {
                officialData = await getOfficialDetails(normalizedResource, officialIndexToFetch);
            } catch { /* Ignore if official data not found */ }
        }
    } else {
        try {
            officialData = await getOfficialDetails(normalizedResource, normalizedIndex);
        } catch { /* Ignore */ }

        const qb = homebrewRepo.createQueryBuilder('hb')
            .where('LOWER(hb.type) = :type', { type: norm(dbType) })
            .andWhere(new Brackets(sqb => {
                sqb.where('LOWER(JSON_EXTRACT(hb.content, "$.official_index")) = :idx', { idx: normalizedIndex })
                   .orWhere('LOWER(JSON_EXTRACT(hb.content, "$.index")) = :idx', { idx: normalizedIndex });
            }))
            .andWhere(new Brackets(sqb => {
                sqb.where('hb.isPublic = :isPublic', { isPublic: true });
                if (userInstalledIds.length > 0) {
                    sqb.orWhere('hb.id IN (:...ids)', { ids: userInstalledIds })
                       .orWhere('hb.bundleId IN (:...ids)', { ids: userInstalledIds });
                }
            }));
        
        hb = await qb.getOne();
    }

    const finalData = hb 
        ? { ...(officialData || {}), ...(typeof hb.content === 'string' ? JSON.parse(hb.content) : hb.content), source: 'homebrew', isHomebrew: true, id: hb.id }
        : officialData ? { ...officialData, source: 'official', isHomebrew: false } : null;

    if (!finalData) return null;

    // Apply translations
    const allIds = new Set(userInstalledIds);
    if (hb?.bundleId) allIds.add(hb.bundleId);
    
    if (allIds.size > 0) {
        const bundles = await AppDataSource.getRepository(HomebrewBundle).find({
            where: { id: In(Array.from(allIds)) },
            relations: ['contents']
        });
        const contentIdsFromBundles = bundles.flatMap(b => b.contents.map(c => c.id));
        const allContentIds = [...new Set([...allIds, ...contentIdsFromBundles])];

        const translations = await homebrewRepo.find({ where: { id: In(allContentIds), type: 'translation' } });
        const translationMap = translations.reduce((acc, curr) => {
            if(curr.content) Object.assign(acc, curr.content);
            return acc;
        }, {});
        return applyTranslation(finalData, translationMap);
    }
    
    return finalData;
}
