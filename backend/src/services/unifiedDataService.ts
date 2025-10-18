// backend/src/services/unifiedDataService.ts
import redisClient from '../database/redis-client.js';
import { AppDataSource } from '../database/data-source.js';
import { HomebrewContent, HomebrewContentType } from '../entities/HomebrewContent.js';
import { getResourceList as getOfficialResourceList, getDetails as getOfficialDetails } from './dndApiService.js';
import { User } from '../entities/User.js';
import { In, Brackets, Not, IsNull } from 'typeorm';
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

// Esta função agora apenas busca da API, sem cache próprio.
const getOfficialList = async (resource: string): Promise<any[]> => {
    const apiResponse = await getOfficialResourceList(resource);
    return apiResponse?.results || [];
};

const applyTranslation = (item: any, translationMap: Record<string, any>) => {
    if (!item || !item.index) return item;
    const key = item.official_index || item.index;
    const translationData = translationMap[key];

    if (translationData) {
        // Cria uma cópia profunda para não modificar o objeto original em cache
        const translatedItem = JSON.parse(JSON.stringify(item));
        
        // Aplica traduções campo a campo
        if(translationData.name) translatedItem.name = translationData.name;
        if(translationData.desc) translatedItem.desc = translationData.desc;
        if(translationData.subclass_flavor) translatedItem.subclass_flavor = translationData.subclass_flavor;

        // Específico para armas e itens com dano
        if(translationData.weapon_category) translatedItem.weapon_category = translationData.weapon_category;
        if(translationData.weapon_range) translatedItem.weapon_range = translationData.weapon_range;
        if(translationData.category_range) translatedItem.category_range = translationData.category_range;
        if(translatedItem.damage && translatedItem.damage.damage_type && translationData.damage_type_name) {
            translatedItem.damage.damage_type.name = translationData.damage_type_name;
        }
        if(translatedItem.two_handed_damage && translatedItem.two_handed_damage.damage_type && translationData.two_handed_damage_type_name) {
            translatedItem.two_handed_damage.damage_type.name = translationData.two_handed_damage_type_name;
        }
        if(translationData.properties && translatedItem.properties && translatedItem.properties.length === translationData.properties.length){
            translatedItem.properties.forEach((p: any, i: number) => {
                p.name = translationData.properties[i];
            });
        }
        
        return translatedItem;
    }
    return item;
};


export async function getUnifiedList(resource: string, userId?: number): Promise<any[]> {
    const normalizedResource = norm(resource);
    console.log(`[UnifiedService] Iniciando getUnifiedList para resource: '${normalizedResource}', userId: ${userId}`);

    const dbType = TYPE_MAP[normalizedResource] || normalizedResource;
    
    // 1. Determina a configuração de homebrew do usuário para criar uma chave de cache única.
    let installedIds: string[] = [];
    if (userId) {
        const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId }, select: ['installedHomebrewIds'] });
        installedIds = user?.installedHomebrewIds || [];
    }
    console.log(`[UnifiedService] Encontrados ${installedIds.length} IDs de homebrew instalados para o usuário ${userId}`);
    
    const installedIdsHash = installedIds.length > 0
        ? crypto.createHash('md5').update(installedIds.sort().join(',')).digest('hex')
        : 'none';

    const cacheKey = `unified-list:${normalizedResource}:user-${userId || 'public'}:${installedIdsHash}`;

    // 2. Tenta buscar do cache com a chave contextual.
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


    // --- Se não estiver no cache, constrói a lista ---

    // 3. Busca a lista oficial da API
    const officialListPromise = getOfficialList(normalizedResource);
    
    // 4. Busca todo o conteúdo homebrew relevante (público + instalado)
    const homebrewRepo = repo();
    const qb = homebrewRepo.createQueryBuilder('hb')
        .where('hb.isPublic = :isPublic', { isPublic: true });

    if (installedIds.length > 0) {
        const bundleIds = installedIds.filter(id => !id.includes('-')); // Simple heuristic for now
        const contentIds = installedIds.filter(id => id.includes('-'));
        
        if (contentIds.length > 0) {
            qb.orWhere('hb.id IN (:...contentIds)', { contentIds });
        }
        if (bundleIds.length > 0) {
            qb.orWhere('hb.bundleId IN (:...bundleIds)', { bundleIds });
        }
    }
    
    const allRelevantHomebrew = await qb.getMany();
    const homebrewForType = allRelevantHomebrew.filter(hb => hb.type === dbType);
    const translations = allRelevantHomebrew.filter(hb => hb.type === 'translation');

    console.log(`[UnifiedService] Query de Homebrew retornou ${homebrewForType.length} itens do tipo '${dbType}' e ${translations.length} itens de tradução.`);
    
    const translationMap: Record<string, any> = {};
    translations.forEach(t => {
        if (t.content) {
            Object.assign(translationMap, t.content);
        }
    });

    const officialList = await officialListPromise;
    
    // 5. Mescla e Traduz
    const finalMap = new Map<string, any>();
    
    // a. Adiciona todos os itens oficiais, já traduzidos.
    officialList.forEach((item) => {
        if (item?.index) {
            const translatedItem = applyTranslation(item, translationMap);
            finalMap.set(norm(item.index), { ...translatedItem, source: 'official', isHomebrew: false });
        }
    });

    // b. Adiciona ou sobrescreve com o conteúdo homebrew
    let overwrittenCount = 0;
    let newCount = 0;
    homebrewForType.forEach(hb => {
        const content = typeof hb.content === 'string' ? JSON.parse(hb.content) : hb.content;
        if (!content) return;

        const officialIndexToOverride = norm(content.official_index || content.index || '');

        if (officialIndexToOverride && finalMap.has(officialIndexToOverride)) {
            const base = finalMap.get(officialIndexToOverride);
            finalMap.set(officialIndexToOverride, {
                ...base,
                ...content,
                name: content.name || base.name,
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
    });
    
    console.log(`[UnifiedService] Sobrescrevendo ${overwrittenCount} oficiais e adicionando ${newCount} novos homebrew.`);

    const mergedList = Array.from(finalMap.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    console.log(`[UnifiedService] Mesclagem concluída. Total de itens: ${mergedList.length}.`);

    // 6. Salva o resultado final no cache.
    if (redisClient && redisClient.isOpen) {
        try {
            await redisClient.set(cacheKey, JSON.stringify(mergedList), { EX: 3600 }); // Cache por 1 hora
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
              sqb.where('LOWER(JSON_UNQUOTE(JSON_EXTRACT(hb.content, "$.official_index"))) = :idx', { idx: normalizedIndex })
                 .orWhere('LOWER(JSON_UNQUOTE(JSON_EXTRACT(hb.content, "$.index"))) = :idx', { idx: normalizedIndex });
          }));
    }
    
    let userInstalledIds: string[] = [];
    if(userId) {
        const user = await AppDataSource.getRepository(User).findOne({ where: { id: userId }, select: ['installedHomebrewIds'] });
        userInstalledIds = user?.installedHomebrewIds || [];
    }

    if (userId) {
        qb.andWhere(new Brackets(sqb => {
            sqb.where('hb.isPublic = :isPublic', { isPublic: true })
               .orWhere('hb.authorId = :userId', { userId });
            if (userInstalledIds.length > 0) {
                 sqb.orWhere('hb.id IN (:...ids)', { ids: userInstalledIds });
                 sqb.orWhere('hb.bundleId IN (:...ids)', { ids: userInstalledIds });
            }
        }));
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
    const translationEntries = await homebrewRepo.find({ where: { type: 'translation', authorId: 1 } });
    const translationMap: Record<string, any> = {};
    translationEntries.forEach(t => {
        if(t.content) Object.assign(translationMap, t.content);
    });

    const translatedFinalData = applyTranslation(finalData, translationMap);
    console.log(`[UnifiedService] Detalhes para '${normalizedResource}/${index}' concluídos. Fonte: ${translatedFinalData.source}`);

    return translatedFinalData;
}