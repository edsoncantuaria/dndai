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
            if (cachedList) {
                console.log(`[UnifiedService] Cache HIT para lista pública: '${listKey}'`);
                return JSON.parse(cachedList);
            }
        } catch (e) { console.error(`[Cache] Erro ao ler lista do Redis: ${listKey}`, e); }
    }
    const apiResponse = await getOfficialResourceList(resource);
    const officialList = apiResponse?.results || [];
    if (redisClient && redisClient.isOpen && officialList.length > 0) {
        await redisClient.set(listKey, JSON.stringify(officialList));
    }
    return officialList;
};

const applyTranslation = (item: any, translations: Record<string, any>) => {
    if (!item || !item.index) return item;
    const key = item.official_index || item.index;
    const translationData = translations[key];
    if (translationData) {
        // Retorna um novo objeto mesclado, priorizando o nome da tradução
        return { ...item, ...translationData, name: translationData.name || item.name };
    }
    return item;
};


export async function getUnifiedList(resource: string, userId?: number): Promise<any[]> {
    const normalizedResource = norm(resource);
    console.log(`[UnifiedService] Iniciando getUnifiedList para resource: '${normalizedResource}', userId: ${userId}`);

    const dbType = TYPE_MAP[normalizedResource] || normalizedResource;

    const officialListPromise = getOfficialList(normalizedResource);

    const homebrewRepo = repo();
    let allRelevantHomebrew: HomebrewContent[] = [];

    if (userId) {
        const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId }, select: ['installedHomebrewIds'] });
        const installedIds = user?.installedHomebrewIds || [];
        console.log(`[UnifiedService] Encontrados ${installedIds.length} IDs de homebrew instalados para o usuário ${userId}`);
        
        if (installedIds.length > 0) {
            allRelevantHomebrew = await homebrewRepo.find({
                where: [
                    { isPublic: true },
                    { id: In(installedIds) },
                    { bundleId: In(installedIds) }
                ]
            });
        } else {
             allRelevantHomebrew = await homebrewRepo.find({ where: { isPublic: true }});
        }
    } else {
        allRelevantHomebrew = await homebrewRepo.find({ where: { isPublic: true }});
    }

    const homebrewForType = allRelevantHomebrew.filter(hb => hb.type === dbType);
    const translations = allRelevantHomebrew.filter(hb => hb.type === 'translation');
    console.log(`[UnifiedService] Query de Homebrew retornou ${homebrewForType.length} itens do tipo '${dbType}' e ${translations.length} itens de tradução.`);
    
    // Constrói o mapa de traduções
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

    let overwrittenCount = 0;
    let newCount = 0;

    for (const hb of homebrewForType) {
        const content = typeof hb.content === 'string' ? JSON.parse(hb.content) : hb.content;
        if (!content) continue;

        const officialIndexToOverride = norm(content.official_index || content.index || '');

        // Aplica a tradução ao conteúdo homebrew ANTES de mesclar
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
            overwrittenCount++;
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
    console.log(`[UnifiedService] Iniciando getUnifiedDetails para resource: '${normalizedResource}', index: '${index}', userId: ${userId}`);
    const dbType = TYPE_MAP[normalizedResource] || normalizedResource;
    const normalizedIndex = norm(index);
    const homebrewRepo = repo();
    const isUuid = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(index);

    let officialData: any = null;
    let hb: HomebrewContent | null = null;
    
    // Sempre busca dados oficiais primeiro se não for um UUID
    if (!isUuid) {
        try {
            officialData = await getOfficialDetails(normalizedResource, normalizedIndex);
        } catch {}
    }

    // Busca o conteúdo homebrew
    const qb = homebrewRepo.createQueryBuilder('hb');
    
    if (isUuid) {
         qb.where('hb.id = :index', { index });
    } else {
        qb.where('LOWER(hb.type) = :type', { type: dbType })
          .andWhere(new Brackets(sqb => {
              sqb.where('LOWER(JSON_EXTRACT(hb.content, "$.official_index")) = :idx', { idx: normalizedIndex })
                 .orWhere('LOWER(JSON_EXTRACT(hb.content, "$.index")) = :idx', { idx: normalizedIndex });
          }));
    }

    // Filtra pelo acesso do usuário
    if (userId) {
        const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId }, select: ['installedHomebrewIds'] });
        const userInstalledIds = user?.installedHomebrewIds || [];
        qb.andWhere(new Brackets(sqb => {
            sqb.where('hb.isPublic = :isPublic', { isPublic: true })
               .orWhere('hb.authorId = :userId', { userId });
            if (userInstalledIds.length > 0) {
                sqb.orWhere('hb.id IN (:...ids)', { ids: userInstalledIds })
                   .orWhere('hb.bundleId IN (:...ids)', { ids: userInstalledIds });
            }
        }));
    } else {
        qb.andWhere('hb.isPublic = :isPublic', { isPublic: true });
    }

    hb = await qb.getOne();
    
    // Se o homebrew foi encontrado por UUID e não tínhamos dados oficiais, tentamos buscar agora
    if (hb && !officialData) {
         const content = typeof hb.content === 'string' ? JSON.parse(hb.content) : hb.content;
         const officialIndex = norm(content?.official_index || content?.index || '');
         if (officialIndex && officialIndex !== hb.id) {
             try { officialData = await getOfficialDetails(normalizedResource, officialIndex); } catch {}
         }
    }

    // Monta a resposta final
    let finalData = officialData ? { ...officialData, source: 'official', isHomebrew: false } : null;

    if (hb) {
        const content = typeof hb.content === 'string' ? JSON.parse(hb.content) : hb.content;
        finalData = { ...(finalData || {}), ...content, source: 'homebrew', isHomebrew: true, homebrewId: hb.id };
    }
    
    if (!finalData) {
        console.log(`[UnifiedService] Nenhum dado oficial ou homebrew encontrado para '${normalizedResource}/${index}'.`);
        return null;
    }

    // Busca e aplica traduções
    const translationRepo = AppDataSource.getRepository(HomebrewContent);
    const translationEntries = await translationRepo.find({ where: { type: 'translation', isPublic: true } });
    const translationMap: Record<string, any> = {};
    translationEntries.forEach(t => {
        if(t.content) Object.assign(translationMap, t.content);
    });

    const translatedFinalData = applyTranslation(finalData, translationMap);
    console.log(`[UnifiedService] Detalhes para '${normalizedResource}/${index}' concluídos. Fonte: ${translatedFinalData.source}`);

    return translatedFinalData;
}
