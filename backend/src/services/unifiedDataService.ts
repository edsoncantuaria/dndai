// backend/src/services/unifiedDataService.ts
import redisClient from '../database/redis-client.js';
import { AppDataSource } from '../database/data-source.js';
import { HomebrewContent, HomebrewContentType } from '../entities/HomebrewContent.js';
import { getResourceList, getDetails } from './dndApiService.js';
import { User } from '../entities/User.js';
import { In, Brackets } from 'typeorm';
import { translateSpell, TRANSLATIONS_SPELLS } from '../../data/TranslatorSpells.js';
import { translateEquipment } from '../../data/TranslatorEquipments.js';
import { TRANSLATIONS_BASE } from '../../data/TranslatorPTBR.js';

const homebrewRepo = () => AppDataSource.getRepository(HomebrewContent);
const norm = (s?: string) => (s ?? '').toLowerCase().trim();
const KEY = (r: string, i?: string) => (i ? `dnd5e:${r}:${i}` : `dnd5e:${r}:list`);

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

async function getOfficialList(resource: string): Promise<any[]> {
    const listKey = `dnd5e:${resource}:list`;
    if (redisClient && redisClient.isOpen) {
        try {
            const cachedList = await redisClient.get(listKey);
            if (cachedList) return JSON.parse(cachedList);
        } catch(e) { console.error(`[Cache] Erro ao ler lista do Redis: ${listKey}`, e); }
    }
    const apiResponse = await getResourceList(resource);
    const officialList = apiResponse?.results || [];
    if (redisClient && redisClient.isOpen && officialList.length > 0) {
        await redisClient.set(listKey, JSON.stringify(officialList));
    }
    return officialList;
}

async function getOfficialDetails(resource: string, index: string): Promise<any> {
    const detailKey = KEY(resource, index);
    if (redisClient && redisClient.isOpen) {
        try {
            const cachedDetail = await redisClient.get(detailKey);
            if (cachedDetail) return JSON.parse(cachedDetail);
        } catch(e) { console.error(`[Cache] Erro ao ler detalhe do Redis: ${detailKey}`, e); }
    }
    const details = await getDetails(resource, index);
    if (redisClient && redisClient.isOpen && details) {
        await redisClient.set(detailKey, JSON.stringify(details));
    }
    return details;
}

// Função de tradução genérica
const translateItem = (item: any, translations: Record<string, any>) => {
    if (!item || !item.index) return item;

    const key = item.index;
    const translationData = translations[key];

    if (translationData) {
        const translated = { ...item };
        // Aplica traduções para campos comuns
        if (translationData.name) translated.name = translationData.name;
        if (translationData.desc) translated.desc = Array.isArray(translationData.desc) ? translationData.desc : [translationData.desc];
        
        // Específico para magias
        if (item.school && translations['Magic Schools']?.[item.school.name]) {
            translated.school.name = translations['Magic Schools'][item.school.name];
        }

        // Adicionar mais lógicas de tradução aninhada aqui se necessário
        return translated;
    }

    return item;
};


export async function getUnifiedList(resource: string, userId?: number): Promise<any[]> {
    const normalizedResource = norm(resource);
    console.log(`[UnifiedService] Iniciando getUnifiedList para resource: '${normalizedResource}', userId: ${userId}`);

    const dbType = TYPE_MAP[normalizedResource] || normalizedResource;
    
    const officialListPromise = getOfficialList(normalizedResource);
    
    let allRelevantHomebrew: HomebrewContent[] = [];
    const userRepo = AppDataSource.getRepository(User);
    
    if (userId) {
        const user = await userRepo.findOne({ where: { id: userId }, select: ['installedHomebrewIds'] });
        const userInstalledIds = user?.installedHomebrewIds || [];
        console.log(`[UnifiedService] Encontrados ${userInstalledIds.length} IDs de homebrew instalados para o usuário ${userId}`);
        
        if (userInstalledIds.length > 0) {
            const qb = homebrewRepo().createQueryBuilder('hb')
                .where(new Brackets(sqb => {
                    sqb.where('hb.isPublic = :isPublic', { isPublic: true })
                       .orWhere('hb.id IN (:...ids)', { ids: userInstalledIds })
                       .orWhere('hb.bundleId IN (:...ids)', { ids: userInstalledIds });
                }));
            console.log('[UnifiedService] SQL da Query Homebrew:', qb.getSql(), qb.getParameters());
            allRelevantHomebrew = await qb.getMany();
        } else {
             allRelevantHomebrew = await homebrewRepo().find({ where: { isPublic: true }});
        }
    } else {
        allRelevantHomebrew = await homebrewRepo().find({ where: { isPublic: true }});
    }

    const homebrewContent = allRelevantHomebrew.filter(hb => hb.type === dbType);
    const homebrewTranslations = allRelevantHomebrew.filter(hb => hb.type === 'translation').reduce((acc, curr) => {
        return { ...acc, ...curr.content };
    }, {} as Record<string, any>);


    console.log(`[UnifiedService] Query de Homebrew retornou ${homebrewContent.length} itens do tipo '${dbType}' e ${Object.keys(homebrewTranslations).length} chaves de tradução.`);

    const officialList = await officialListPromise;
    const finalMap = new Map<string, any>();
    
    officialList.forEach(item => {
        if (item && item.index) {
            finalMap.set(norm(item.index), { ...item, source: 'official', isHomebrew: false });
        }
    });

    let overwrittenCount = 0;
    let newCount = 0;

    homebrewContent.forEach(hb => {
        const content = typeof hb.content === 'string' ? JSON.parse(hb.content) : hb.content;
        if (!content) return;
        
        const officialIndexToOverride = norm(content.official_index || content.index || '');
        if (officialIndexToOverride && finalMap.has(officialIndexToOverride)) {
            const base = finalMap.get(officialIndexToOverride);
            finalMap.set(officialIndexToOverride, {
                ...base,
                ...content,
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
            if (!finalMap.has(newIdx)) {
                finalMap.set(newIdx, {
                    ...content,
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
    });
    
    console.log(`[UnifiedService] Sobrescrevendo ${overwrittenCount} oficiais e adicionando ${newCount} novos homebrew.`);

    const mergedList = Array.from(finalMap.values());

    // Aplicar traduções
    const translatedList = mergedList.map(item => {
        if (dbType === 'spell') return translateSpell(item);
        if (dbType === 'item' || dbType === 'equipment') return translateEquipment(item);

        // Lógica genérica de tradução
        const generalTranslation = TRANSLATIONS_BASE[item.name] || TRANSLATIONS_BASE['Races'][item.name] || TRANSLATIONS_BASE['Classes'][item.name] || TRANSLATIONS_BASE['Alignments'][item.name];
        if (generalTranslation) {
            return { ...item, name: generalTranslation };
        }
        return item;
    });

    const finalList = translatedList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    console.log(`[UnifiedService] Mesclagem concluída. Total de itens: ${finalList.length}.`);
    return finalList;
}


export async function getUnifiedDetails(resource: string, index: string, userId?: number): Promise<any> {
  const normalizedResource = norm(resource);
  const dbType = TYPE_MAP[normalizedResource] || normalizedResource;
  const normalizedIndex = norm(index);
  const isUuid = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(index);

  let officialData: any = null;
  let hb: HomebrewContent | null = null;

  // 1. Fetch official data if not a UUID
  if (!isUuid) {
    try { 
      officialData = await getOfficialDetails(normalizedResource, normalizedIndex); 
    } catch {}
  }
  
  // 2. Fetch relevant homebrew content (public and user's installed)
  const homebrewRepo = repo();
  const qb = homebrewRepo.createQueryBuilder('hb')
    .where('LOWER(hb.type) = :type', { type: dbType });

  if (isUuid) {
      qb.andWhere('hb.id = :id', { id: index });
  } else {
      qb.andWhere(new Brackets(sqb => {
        sqb.where('LOWER(JSON_EXTRACT(hb.content, "$.official_index")) = :idx', { idx: normalizedIndex })
           .orWhere('LOWER(JSON_EXTRACT(hb.content, "$.index")) = :idx', { idx: normalizedIndex });
      }));
  }

  if (userId) {
    const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId }, select: ['installedHomebrewIds'] });
    const userInstalledIds = user?.installedHomebrewIds || [];
    if (userInstalledIds.length > 0) {
      qb.andWhere(new Brackets(sqb => {
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

  let finalData: any = officialData ? { ...officialData, source: 'official', isHomebrew: false } : null;

  if (hb) {
      const content = typeof hb.content === 'string' ? JSON.parse(hb.content) : hb.content;
      finalData = { ...(finalData || {}), ...content, source: 'homebrew', isHomebrew: true, id: hb.id };
  }

  if (!finalData) return null;
  
  // 3. Apply translations
  if (dbType === 'spell') return translateSpell(finalData);
  if (dbType === 'item' || dbType === 'equipment') return translateEquipment(finalData);
  
  return finalData;
}
