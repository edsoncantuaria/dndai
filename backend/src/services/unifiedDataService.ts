// backend/src/services/unifiedDataService.ts
import redisClient from '../database/redis-client.js';
import { AppDataSource } from '../database/data-source.js';
import { HomebrewContent, HomebrewContentType } from '../entities/HomebrewContent.js';
import { getResourceList as getOfficialResourceList, getDetails as getOfficialDetails } from './dndApiService.js';
import { User } from '../entities/User.js';
import { In, Brackets } from 'typeorm';
import createError from 'http-errors';
import { HomebrewBundle } from '../entities/HomebrewBundle.js';
import crypto from 'crypto';


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

// Remove cache from here, it will be handled by the main function
const getOfficialList = async (resource: string): Promise<any[]> => {
    const apiResponse = await getOfficialResourceList(resource);
    return apiResponse?.results || [];
};

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
    const normalizedResource = norm(resource);
    const dbType = TYPE_MAP[normalizedResource] || normalizedResource;
    
    // 1. Determine user's installed content to create a unique cache key
    let installedIds: string[] = [];
    if (userId) {
        const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId }, select: ['installedHomebrewIds'] });
        installedIds = user?.installedHomebrewIds || [];
    }
    
    // Create a hash of installed IDs to represent the current state
    const installedIdsHash = installedIds.length > 0
        ? crypto.createHash('md5').update(installedIds.sort().join(',')).digest('hex')
        : 'none';

    const cacheKey = `unified-list:${normalizedResource}:${userId || 'public'}:${installedIdsHash}`;

    // 2. Try to fetch the final, merged list from cache
    if (redisClient && redisClient.isOpen) {
        try {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                console.log(`[UnifiedService] Cache HIT para lista unificada: '${cacheKey}'`);
                return JSON.parse(cachedData);
            }
        } catch (e) { console.error(`[Cache] Erro ao ler lista do Redis: ${cacheKey}`, e); }
    }
    console.log(`[UnifiedService] Cache MISS para lista unificada: '${cacheKey}'`);


    // --- If not in cache, build the list from scratch ---

    // 3. Fetch official list and all relevant homebrew content
    const officialListPromise = getOfficialList(normalizedResource);
    const homebrewRepo = repo();
    
    const qb = homebrewRepo.createQueryBuilder('hb')
        .where('hb.isPublic = :isPublic', { isPublic: true });

    if (installedIds.length > 0) {
        qb.orWhere('hb.id IN (:...ids)', { ids: installedIds })
          .orWhere('hb.bundleId IN (:...ids)', { ids: installedIds });
    }
    
    const allRelevantHomebrew = await qb.getMany();
    
    const homebrewForType = allRelevantHomebrew.filter(hb => hb.type === dbType);
    const translations = allRelevantHomebrew.filter(hb => hb.type === 'translation');

    const translationMap: Record<string, any> = {};
    translations.forEach(t => {
        if (t.content) {
            Object.assign(translationMap, t.content);
        }
    });

    const officialList = (await officialListPromise).map(item => applyTranslation(item, translationMap));
    
    const finalMap = new Map<string, any>();
    officialList.forEach((item) => {
        if (item?.index) {
            finalMap.set(norm(item.index), { ...item, source: 'official', isHomebrew: false });
        }
    });

    homebrewForType.forEach(hb => {
        const content = typeof hb.content === 'string' ? JSON.parse(hb.content) : hb.content;
        if (!content) return;

        const officialIndexToOverride = norm(content.official_index || content.index || '');

        const translatedContent = applyTranslation(content, translationMap);

        if (officialIndexToOverride && finalMap.has(officialIndexToOverride)) {
            const base = finalMap.get(officialIndexToOverride);
            finalMap.set(officialIndexToOverride, {
                ...base,
                ...translatedContent,
                name: translatedContent.name || base.name,
                index: base.index,
                source: 'homebrew',
                isHomebrew: true,
                homebrewId: hb.id,
                authorId: hb.authorId,
                url: `/api/data/${normalizedResource}/${base.index}`,
            });
        } else {
            const newIdx = norm(content.index || hb.id);
            finalMap.set(newIdx, {
                ...translatedContent,
                index: content.index || hb.id,
                source: 'homebrew',
                isHomebrew: true,
                homebrewId: hb.id,
                authorId: hb.authorId,
                url: `/api/data/${normalizedResource}/${content.index || hb.id}`,
            });
        }
    });

    const mergedList = Array.from(finalMap.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    // 4. Save the final, merged list to cache
    if (redisClient && redisClient.isOpen) {
        try {
            await redisClient.set(cacheKey, JSON.stringify(mergedList), { EX: 3600 }); // Cache for 1 hour
            console.log(`[UnifiedService] Cache SET para lista unificada: '${cacheKey}'`);
        } catch (e) {
            console.error(`[Cache] Erro ao salvar lista unificada no Redis: ${cacheKey}`, e);
        }
    }
    
    return mergedList;
}

export async function getUnifiedDetails(resource: string, index: string, userId?: number): Promise<any> {
    const normalizedResource = norm(resource);
    console.log(`[UnifiedService] Iniciando getUnifiedDetails para resource: '${normalizedResource}', index: '${index}', userId: ${userId}`);
    const dbType = TYPE_MAP[normalizedResource] || normalizedResource;
    const normalizedIndex = norm(index);
    const homebrewRepo = repo();
    const isUuid = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(index);

    let officialData: any = null;
    let hb: HomebrewContent | null = null;
    
    if (!isUuid) {
        try {
            officialData = await getOfficialDetails(normalizedResource, normalizedIndex);
        } catch {}
    }

    const qb = homebrewRepo.createQueryBuilder('hb');
    
    if (isUuid) {
         qb.where('hb.id = :index', { index });
    } else {
        qb.where('LOWER(hb.type) = :type', { type: dbType })
          .andWhere(new Brackets(sqb => {
              sqb.where('LOWER(JSON_UNQUOTE(JSON_EXTRACT(hb.content, "$.official_index"))) = :idx', { idx: `"${normalizedIndex}"` })
                 .orWhere('LOWER(JSON_UNQUOTE(JSON_EXTRACT(hb.content, "$.index"))) = :idx', { idx: `"${normalizedIndex}"` });
          }));
    }

    if (userId) {
        const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId }, select: ['installedHomebrewIds'] });
        const userInstalledIds = user?.installedHomebrewIds || [];
        if (userInstalledIds.length > 0) {
            qb.andWhere(new Brackets(sqb => {
                sqb.where('hb.isPublic = :isPublic', { isPublic: true })
                   .orWhere('hb.authorId = :userId', { userId })
                   .orWhere('hb.id IN (:...ids)', { ids: userInstalledIds })
                   .orWhere('hb.bundleId IN (:...ids)', { ids: userInstalledIds });
            }));
        } else {
            qb.andWhere('hb.isPublic = :isPublic OR hb.authorId = :userId', { isPublic: true, userId });
        }
    } else {
        qb.andWhere('hb.isPublic = :isPublic', { isPublic: true });
    }

    hb = await qb.getOne();
    
    if (hb && !officialData) {
         const content = typeof hb.content === 'string' ? JSON.parse(hb.content) : hb.content;
         const officialIndex = norm(content?.official_index || content?.index || '');
         if (officialIndex && officialIndex !== hb.id) {
             try { officialData = await getOfficialDetails(normalizedResource, officialIndex); } catch {}
         }
    }

    let finalData = officialData ? { ...officialData, source: 'official', isHomebrew: false } : null;

    if (hb) {
        const content = typeof hb.content === 'string' ? JSON.parse(hb.content) : hb.content;
        finalData = { ...(finalData || {}), ...content, source: 'homebrew', isHomebrew: true, homebrewId: hb.id };
    }
    
    if (!finalData) {
        console.log(`[UnifiedService] Nenhum dado oficial ou homebrew encontrado para '${normalizedResource}/${index}'.`);
        return null;
    }

    // Busca e aplica traduções separadamente
    const translationEntries = await homebrewRepo.find({ where: { type: 'translation', isPublic: true } });
    const translationMap: Record<string, any> = {};
    translationEntries.forEach(t => {
        if(t.content) Object.assign(translationMap, t.content);
    });

    const translatedFinalData = applyTranslation(finalData, translationMap);
    console.log(`[UnifiedService] Detalhes para '${normalizedResource}/${index}' concluídos. Fonte: ${translatedFinalData.source}`);

    return translatedFinalData;
}
