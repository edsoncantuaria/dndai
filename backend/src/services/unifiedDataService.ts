// backend/src/services/unifiedDataService.ts
import redisClient from '../database/redis-client.js';
import { AppDataSource } from '../database/data-source.js';
import { HomebrewContent, HomebrewContentType } from '../entities/HomebrewContent.js';
import { getResourceList, getDetails } from './dndApiService.js';
import { User } from '../entities/User.js';
import { HomebrewBundle } from '../entities/HomebrewBundle.js';
import { In, Brackets } from 'typeorm';

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
    const listKey = KEY(resource);
    if (redisClient && redisClient.isOpen) {
        try {
            const cachedList = await redisClient.get(listKey);
            if (cachedList) return JSON.parse(cachedList);
        } catch(e) { console.error(`[Cache] Erro ao ler lista do Redis: ${listKey}`, e); }
    }
    const apiResponse = await getResourceList(resource);
    const officialList = apiResponse?.results || [];
    if (redisClient && redisClient.isOpen && officialList.length > 0) {
        // Cache persistente, sem expiração
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
        // Cache persistente
        await redisClient.set(detailKey, JSON.stringify(details));
    }
    return details;
}

// Função de tradução genérica
const applyTranslation = (item: any, translations: Record<string, any>) => {
    if (!item || !item.index) return item;
    const key = item.index;
    const translationData = translations[key];
    if (translationData) {
        return { ...item, ...translationData };
    }
    return item;
};


export async function getUnifiedList(resource: string, userId?: number): Promise<any[]> {
    const normalizedResource = norm(resource);
    console.log(`[UnifiedService] Iniciando getUnifiedList para resource: '${normalizedResource}', userId: ${userId}`);

    const dbType = TYPE_MAP[normalizedResource] || normalizedResource;
    
    // 1. Pega dados oficiais (da API ou cache)
    const officialListPromise = getOfficialList(normalizedResource);
    
    // 2. Pega homebrews e traduções
    let allHomebrew: HomebrewContent[] = [];
    let allTranslations: HomebrewContent[] = [];

    if (userId) {
        const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId }, select: ['installedHomebrewIds'] });
        const installedIds = user?.installedHomebrewIds || [];
        console.log(`[UnifiedService] Encontrados ${installedIds.length} IDs de homebrew instalados para o usuário ${userId}`);
        
        if (installedIds.length > 0) {
            const bundles = await AppDataSource.getRepository(HomebrewBundle).find({
                where: { id: In(installedIds) },
                relations: ['contents']
            });
            const contentIdsFromBundles = bundles.flatMap(b => b.contents.map(c => c.id));
            const allIds = [...new Set([...installedIds, ...contentIdsFromBundles])];

             if (allIds.length > 0) {
                allHomebrew = await homebrewRepo().find({
                    where: [
                        { isPublic: true },
                        { id: In(allIds) }
                    ]
                });
            } else {
                 allHomebrew = await homebrewRepo().find({ where: { isPublic: true } });
            }
        } else {
             allHomebrew = await homebrewRepo().find({ where: { isPublic: true } });
        }
    } else {
        allHomebrew = await homebrewRepo().find({ where: { isPublic: true } });
    }

    const homebrewContent = allHomebrew.filter(hb => hb.type === dbType);
    allTranslations = allHomebrew.filter(hb => hb.type === 'translation');

    const translationsByCategory = allTranslations.reduce((acc, curr) => {
        if (curr.content) {
            acc[curr.name] = { ...acc[curr.name], ...curr.content };
        }
        return acc;
    }, {} as Record<string, any>);

    console.log(`[UnifiedService] Query de Homebrew retornou ${homebrewContent.length} itens do tipo '${dbType}' e ${allTranslations.length} itens de tradução.`);

    const officialList = await officialListPromise;

    // 3. Merge e Tradução
    const finalMap = new Map<string, any>();
    
    officialList.forEach(item => {
        if (item?.index) {
            finalMap.set(norm(item.index), { ...item, source: 'official', isHomebrew: false });
        }
    });

    homebrewContent.forEach(hb => {
        const content = typeof hb.content === 'string' ? JSON.parse(hb.content) : hb.content;
        const officialIndexToOverride = norm(content.official_index || content.index || '');
        if (finalMap.has(officialIndexToOverride)) {
            const base = finalMap.get(officialIndexToOverride);
            finalMap.set(officialIndexToOverride, { ...base, ...content, source: 'homebrew', isHomebrew: true, homebrewId: hb.id, authorId: hb.authorId, url: `/api/data/${normalizedResource}/${base.index}` });
        } else {
            const newIdx = norm(content.index || hb.id);
            finalMap.set(newIdx, { ...content, index: newIdx, source: 'homebrew', isHomebrew: true, homebrewId: hb.id, authorId: hb.authorId, url: `/api/data/${normalizedResource}/${newIdx}` });
        }
    });

    const translatedList = Array.from(finalMap.values()).map(item => {
        const translationsForType = translationsByCategory[item.type] || translationsByCategory[dbType];
        if (translationsForType) {
            return applyTranslation(item, translationsForType);
        }
        // Tradução manual para equipamentos
        if(dbType === 'item' || dbType === 'equipment') {
            const equipmentTranslations = translationsByCategory['Equipamentos'];
            if(equipmentTranslations) {
                return applyTranslation(item, equipmentTranslations);
            }
        }
        // Tradução manual para magias
         if(dbType === 'spell') {
            const spellTranslations = translationsByCategory['Spells'];
            if(spellTranslations) {
                return applyTranslation(item, spellTranslations);
            }
        }
        return item;
    });

    return translatedList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}


export async function getUnifiedDetails(resource: string, index: string, userId?: number): Promise<any> {
    const normalizedResource = norm(resource);
    const dbType = TYPE_MAP[normalizedResource] || normalizedResource;
    const normalizedIndex = norm(index);
    const isUuid = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(index);

    let officialData: any = null;
    let hb: HomebrewContent | null = null;
    const contentRepo = homebrewRepo();

    if (isUuid) {
        hb = await contentRepo.findOneBy({ id: index });
        if (!hb) return null;
        if (!hb.isPublic && hb.authorId !== userId) throw createError(403, 'Acesso negado a este conteúdo privado.');
        const officialIndex = norm(hb.content?.official_index || hb.content?.index);
        if (officialIndex) {
            officialData = await getOfficialDetails(normalizedResource, officialIndex).catch(() => null);
        }
    } else {
        officialData = await getOfficialDetails(normalizedResource, normalizedIndex).catch(() => null);
        
        const qb = contentRepo.createQueryBuilder('hb')
            .where('LOWER(hb.type) = :type', { type: dbType })
            .andWhere(new Brackets(sqb => {
                sqb.where('LOWER(JSON_EXTRACT(hb.content, "$.official_index")) = :idx', { idx: normalizedIndex })
                   .orWhere('LOWER(JSON_EXTRACT(hb.content, "$.index")) = :idx', { idx: normalizedIndex });
            }));

        if (userId) {
            const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId }, select: ['installedHomebrewIds'] });
            const installedIds = user?.installedHomebrewIds || [];
            if (installedIds.length > 0) {
                 const bundles = await AppDataSource.getRepository(HomebrewBundle).find({
                    where: { id: In(installedIds) },
                    relations: ['contents']
                });
                const contentIdsFromBundles = bundles.flatMap(b => b.contents.map(c => c.id));
                const allIds = [...new Set([...installedIds, ...contentIdsFromBundles])];
                
                if (allIds.length > 0) {
                    qb.andWhere(new Brackets(sqb => {
                        sqb.where('hb.isPublic = :isPublic', { isPublic: true })
                        .orWhere('hb.id IN (:...ids)', { ids: allIds });
                    }));
                } else {
                    qb.andWhere('hb.isPublic = :isPublic', { isPublic: true });
                }
            } else {
                 qb.andWhere('hb.isPublic = :isPublic', { isPublic: true });
            }
        } else {
            qb.andWhere('hb.isPublic = :isPublic', { isPublic: true });
        }
        hb = await qb.getOne();
    }

    let finalData = officialData ? { ...officialData, source: 'official', isHomebrew: false } : null;

    if (hb) {
        const content = typeof hb.content === 'string' ? JSON.parse(hb.content) : hb.content;
        finalData = { ...(finalData || {}), ...content, source: 'homebrew', isHomebrew: true, id: hb.id };
    }
    
    if (!finalData) return null;

    // Busca e aplica tradução
    const translationRepo = AppDataSource.getRepository(HomebrewContent);
    const translations = await translationRepo.find({ where: { type: 'translation', isPublic: true }});
    const translationMap = translations.reduce((acc, curr) => {
        Object.assign(acc, curr.content);
        return acc;
    }, {});
    
    return applyTranslation(finalData, translationMap);
}
