import redisClient from '../../database/redis-client.js';
import { PenaiDataSource } from '../database/data-source.js';
import { PenaiHomebrewContent } from '../database/entities/HomebrewContent.js';
import { PenaiUser } from '../database/entities/PenaiUser.js';
import crypto from 'crypto';
import { Brackets } from 'typeorm';

import * as DndApiModule from '../../services/dndApiService.js';
import { mergeOfficialWithHomebrew, resolveOfficialIndex } from '../../services/homebrewMergeService.js';
import { inferSourceKind } from '../../services/srdHomebrewValidator.js';
import { isValidResourceDetail } from '../../services/srdResourceValidation.js';
import { SYSTEM_AUTHOR_ID } from '../database/seed/seedSrdPtBrHomebrew.js';
const DndApi = DndApiModule.default || DndApiModule.DndApi || DndApiModule;

type HomebrewContent = PenaiHomebrewContent;
const AppDataSource = PenaiDataSource;

const repo = () => PenaiDataSource.getRepository(PenaiHomebrewContent);
const userRepo = () => PenaiDataSource.getRepository(PenaiUser);
const localHexCache = new Map<number, string>();

const norm = (s?: string) => (s ?? '').toLowerCase().trim();
const globalKey = (r: string, i?: string) =>
  i ? `dnd5e:v2:2014:${r}:${i}` : `dnd5e:v2:2014:${r}:list`;
const userKey = (uid: number, hex: string, r: string, i?: string) =>
  i ? `user:${uid}:${hex}:${r}:${i}` : `user:${uid}:${hex}:${r}:list`;

const TYPE_MAP: Record<string, string> = {
  equipment: 'item',
  'equipment-categories': 'equipment-category',
  races: 'race',
  classes: 'class',
  backgrounds: 'background',
  spells: 'spell',
  feats: 'feat',
  features: 'feature',
  languages: 'language',
  conditions: 'condition',
  monsters: 'monster',
  proficiencies: 'proficiency',
  subclasses: 'subclass',
  subraces: 'subrace',
  traits: 'trait',
  'ability-scores': 'ability-score',
  'damage-types': 'damage-type',
  'magic-schools': 'magic-school',
};

function applySystemHomebrewToMap(
  map: Map<string, any>,
  homebrews: HomebrewContent[],
  normalizedResource: string,
): void {
  for (const hb of homebrews) {
    const content = typeof hb.content === 'string' ? JSON.parse(hb.content) : hb.content;
    const key = homebrewMatchKey(hb, content, normalizedResource);
    if (!map.has(key)) continue;
    const officialItem = map.get(key);
    const mergedContent = mergeHomebrewEntry(officialItem, hb, content, normalizedResource);
    map.set(key, {
      ...mergedContent,
      source: 'homebrew',
      isHomebrew: true,
      id: hb.id,
      sourceKind: hb.sourceKind,
      locale: hb.locale,
    });
  }
}

async function loadSystemHomebrewOverlays(dbType: string): Promise<HomebrewContent[]> {
  return repo().find({
    where: {
      authorId: SYSTEM_AUTHOR_ID,
      type: dbType as PenaiHomebrewContent['type'],
    },
  });
}

function mergeHomebrewEntry(
  officialItem: Record<string, unknown> | undefined,
  hb: HomebrewContent,
  content: Record<string, unknown>,
  srdResource: string,
) {
  const sourceKind = hb.sourceKind ?? inferSourceKind(content);
  const resource = hb.sourceResource ?? srdResource;
  if (officialItem && sourceKind !== 'original') {
    return mergeOfficialWithHomebrew(officialItem, content, sourceKind, resource);
  }
  return { ...content };
}

function homebrewMatchKey(hb: HomebrewContent, content: Record<string, unknown>, srdResource: string): string {
  const fromMeta = resolveOfficialIndex(content, {
    sourceIndex: hb.sourceIndex,
    sourceKind: hb.sourceKind,
  });
  if (fromMeta) return fromMeta;
  if (typeof content.index === 'string') return norm(content.index);
  return norm(hb.name);
}

/**
 * Obtém ou gera o HEX de cache do usuário.
 */
async function ensureUserHex(userId: number): Promise<string> {
  const user = await userRepo().findOne({ where: { id: userId }, select: ['id'] }); // Removido 'homebrewCacheHex'
  if (!user) throw new Error('Usuário não encontrado.');
  
  const hexKey = `user:${userId}:cache_hex`;

  if (redisClient && redisClient.isOpen) {
      try {
          const cachedHex = await redisClient.get(hexKey);
          if (cachedHex) {
              return cachedHex;
          }
      } catch (err) {
          console.error(`[Cache] Falha ao ler hex de usuário ${userId}:`, err);
      }

      const generatedHex = crypto.randomBytes(6).toString('hex');
      try {
          await redisClient.set(hexKey, generatedHex, { EX: 60 * 60 * 24 * 30 }); // 30 dias
      } catch (err) {
          console.error(`[Cache] Falha ao salvar hex de usuário ${userId}:`, err);
      }
      return generatedHex;
  }

  const existingLocal = localHexCache.get(userId);
  if (existingLocal) return existingLocal;

  const generatedHex = crypto.randomBytes(6).toString('hex');
  localHexCache.set(userId, generatedHex);
  return generatedHex;
}

/**
 * Invalida o cache do usuário, deletando chaves antigas.
 */
export async function invalidateUserCache(userId: number) {
    if (redisClient && redisClient.isOpen) {
        try {
            // Usa SCAN para evitar bloquear o Redis em produção
            let cursor = '0';
            do {
                const scanResult: { cursor: string; keys: string[] } = await (redisClient as any).scan(cursor, { MATCH: `user:${userId}:*`, COUNT: 100 });
                cursor = scanResult.cursor;
                const keysToDelete = scanResult.keys;

                if (keysToDelete.length > 0) {
                    await redisClient.del(...keysToDelete);
                    console.log(`[Cache] Invalidadas ${keysToDelete.length} chaves de cache antigas para o usuário ${userId}.`);
                }
            } while (cursor !== '0');
        } catch (err) {
             console.error(`[Cache] Erro ao deletar chaves antigas para o usuário ${userId}:`, err);
        }
    }
}

/**
 * Busca lista oficial, validando o cache.
 */
async function getOfficialList(resource: string): Promise<any[]> {
  const listKey = globalKey(resource);
  const useCache = redisClient && redisClient.isOpen;

  if (useCache) {
    try {
      const cached = await redisClient.get(listKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.results)) {
          console.log(`[dndApiService-Cache] HIT para chave: ${listKey}`);
          return parsed.results;
        }
      }
    } catch (err) {
      console.error(`[Cache] Erro ao ler chave ${listKey}:`, err);
    }
  }

  // 🔧 Aqui está o ponto crítico:
  // Asseguramos que o método seja chamado corretamente independente da exportação
  const getListFn =
    DndApi.getResourceList ||
    DndApi.getList ||
    (typeof DndApi === 'function' ? DndApi : null);

  if (!getListFn) {
    throw new Error('[UnifiedDataService] Erro: DndApi.getResourceList não está definido.');
  }

  const data = await getListFn.call(DndApi, resource);
  const results = data?.results || [];

  if (useCache && data) {
    try {
      await redisClient.set(listKey, JSON.stringify(data));
      console.log(`[Cache] SET persistente: ${listKey}`);
    } catch (err) {
      console.error(`[Cache] Falha ao salvar no Redis ${listKey}:`, err);
    }
  }

  return results;
}

/**
 * Busca detalhes oficiais, validando o cache.
 */
async function getOfficialDetails(resource: string, index: string): Promise<any | null> {
  const normalizedResource = norm(resource);
  const normalizedIndex = norm(index);
  const key = globalKey(normalizedResource, normalizedIndex);
  const useCache = redisClient && redisClient.isOpen;

  if (useCache) {
    try {
      const cached = await redisClient.get(key);
      if (cached && cached !== 'null' && cached !== '{}') {
        const parsed = JSON.parse(cached);
        if (isValidResourceDetail(normalizedResource, normalizedIndex, parsed)) {
          console.log(`[dndApiService-Cache] HIT detalhes: ${key}`);
          return parsed;
        }
        await redisClient.del(key);
      }
    } catch (err) {
      console.error(`[Cache] Erro ao ler chave ${key}:`, err);
    }
  }

  const getDetailsFn =
    DndApi.getDetails ||
    DndApi.getResourceDetails ||
    (typeof DndApi === 'function' ? DndApi : null);

  if (!getDetailsFn) {
    throw new Error('[UnifiedDataService] Erro: DndApi.getDetails não está definido.');
  }

  const data = await getDetailsFn.call(DndApi, resource, index);

  if (useCache && data && isValidResourceDetail(normalizedResource, normalizedIndex, data)) {
    try {
      await redisClient.set(key, JSON.stringify(data));
    } catch (err) {
       console.error(`[Cache] Falha ao salvar no Redis ${key}:`, err);
    }
  }

  return data || {};
}


/**
 * Monta lista unificada (Oficial + Homebrew).
 */
export async function getUnifiedList(resource: string, userId?: number): Promise<any[]> {
  const normalizedResource = norm(resource);
  const dbType = TYPE_MAP[normalizedResource] || normalizedResource;
  
  const officialList = await getOfficialList(normalizedResource);
  console.log(`[UnifiedDataService] Lista oficial obtida com sucesso (${officialList.length} items)`);

  const map = new Map<string, any>();
  
  // 1. Oficiais
  for (const item of officialList) {
    if (item && item.index) {
        map.set(norm(item.index), { ...item, isHomebrew: false, source: 'official' });
    }
  }
  
  // 2. Traduções (otimizado com Map)
  const translations = await repo().find({ where: { type: 'translation', authorId: 1 } });
  const tMap = new Map(translations.map(t => {
      const content = typeof t.content === 'string' ? JSON.parse(t.content) : t.content;
      const key = norm(content.official_index || content.index);
      return [key, content];
  }));

  for (const [key, trans] of tMap.entries()) {
      if (map.has(key)) {
          const existing = map.get(key);
          map.set(key, { ...existing, ...trans, name: trans.name || existing.name, desc: trans.desc || existing.desc });
      }
  }

  const systemOverlays = await loadSystemHomebrewOverlays(dbType);
  applySystemHomebrewToMap(
    map,
    systemOverlays.filter(hb => hb.sourceKind === 'translation' || hb.sourceKind === 'fork'),
    normalizedResource,
  );

  if (!userId) return Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const hex = await ensureUserHex(userId);
  const uKey = userKey(userId, hex, normalizedResource, 'list');

  if (redisClient && redisClient.isOpen) {
    const cachedUser = await redisClient.get(uKey);
    if (cachedUser) return JSON.parse(cachedUser);
  }

  const user = await userRepo().findOne({ where: { id: userId }, select: ['installedHomebrewIds'] });
  const installedIds = user?.installedHomebrewIds || [];

  if (installedIds.length > 0) {
      const qb = repo().createQueryBuilder('hb');
      qb.where('LOWER(hb.type) = :type', { type: dbType })
        .andWhere(new Brackets(sqb => {
          sqb.where('hb.id IN (:...ids)', { ids: installedIds })
             .orWhere('hb.bundleId IN (:...ids)', { ids: installedIds });
        }));

      const homebrews = await qb.getMany();

      for (const hb of homebrews) {
        const content = typeof hb.content === 'string' ? JSON.parse(hb.content) : hb.content;
        const key = homebrewMatchKey(hb, content, normalizedResource);

        if (map.has(key)) {
          const officialItem = map.get(key);
          const mergedContent = mergeHomebrewEntry(officialItem, hb, content, normalizedResource);
          map.set(key, {
            ...mergedContent,
            source: 'homebrew',
            isHomebrew: true,
            id: hb.id,
            sourceKind: hb.sourceKind,
            locale: hb.locale,
          });
        } else if (hb.sourceKind === 'original' || !content.official_index) {
          map.set(key, {
            ...content,
            isHomebrew: true,
            source: 'homebrew',
            id: hb.id,
            sourceKind: hb.sourceKind ?? 'original',
          });
        }
      }
  }

  const merged = Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  if (redisClient && redisClient.isOpen && merged.length > 0) {
    try {
        await redisClient.set(uKey, JSON.stringify(merged));
    } catch(err) {
        console.error(`[Cache] Falha ao salvar no Redis ${uKey}:`, err);
    }
  }

  return merged;
}

/**
 * Busca detalhes unificados (Oficial + Homebrew).
 */
export async function getUnifiedDetails(resource: string, index: string, userId?: number): Promise<any | null> {
  const normalizedResource = norm(resource);
  const dbType = TYPE_MAP[normalizedResource] || normalizedResource;
  const normalizedIndex = norm(index);
  
  let officialData = await getOfficialDetails(normalizedResource, normalizedIndex);

  if (officialData) {
    const systemOverlay = await repo().findOne({
      where: {
        authorId: SYSTEM_AUTHOR_ID,
        type: dbType as PenaiHomebrewContent['type'],
        sourceIndex: normalizedIndex,
      },
    });
    if (systemOverlay && systemOverlay.sourceKind !== 'original') {
      const content =
        typeof systemOverlay.content === 'string'
          ? JSON.parse(systemOverlay.content)
          : systemOverlay.content;
      officialData = mergeOfficialWithHomebrew(
        officialData as Record<string, unknown>,
        content,
        systemOverlay.sourceKind ?? 'translation',
        systemOverlay.sourceResource ?? normalizedResource,
      );
    }
  }

  let homebrew: HomebrewContent | null = null;
  if (userId) {
    const user = await userRepo().findOne({ where: { id: userId }, select: ['installedHomebrewIds'] });
    const installedIds = user?.installedHomebrewIds || [];

    if (installedIds.length > 0) {
        const homebrewRepo = repo();
        const qb = homebrewRepo.createQueryBuilder('hb');
        qb.where('LOWER(hb.type) = :type', { type: dbType })
          .andWhere(new Brackets(sqb => {
             sqb.where("LOWER(COALESCE(hb.sourceIndex, '')) = :index", { index: normalizedIndex })
                .orWhere("LOWER(hb.content->>'index') = :index", { index: normalizedIndex })
                .orWhere("LOWER(hb.content->>'official_index') = :index", { index: normalizedIndex });
             if (/^[0-9a-f-]{36}$/.test(normalizedIndex)) {
                sqb.orWhere('hb.id = :homebrewId', { homebrewId: normalizedIndex });
             }
          }))
          .andWhere(new Brackets(sqb => {
             sqb.where('hb.id IN (:...ids)', { ids: installedIds })
                .orWhere('hb.bundleId IN (:...ids)', { ids: installedIds });
          }))
          .orderBy('hb.authorId', 'DESC'); // Prioriza o conteúdo do usuário sobre o público se houver conflito
        
        homebrew = await qb.getOne();
    }
  }

  if (homebrew) {
    const content = typeof homebrew.content === 'string' ? JSON.parse(homebrew.content) : homebrew.content;
    const sourceKind = homebrew.sourceKind ?? inferSourceKind(content);
    const srdResource = homebrew.sourceResource ?? normalizedResource;

    if (officialData && sourceKind !== 'original') {
      const merged = mergeOfficialWithHomebrew(
        officialData as Record<string, unknown>,
        content,
        sourceKind,
        srdResource,
      );
      return {
        ...merged,
        isHomebrew: true,
        source: 'homebrew',
        id: homebrew.id,
        sourceKind,
        locale: homebrew.locale,
      };
    }

    const finalData = officialData
      ? { ...officialData, ...content, name: content.name || officialData.name, desc: content.desc || officialData.desc }
      : content;
    return {
      ...finalData,
      isHomebrew: true,
      source: 'homebrew',
      id: homebrew.id,
      sourceKind,
      locale: homebrew.locale,
    };
  }

  return officialData ? { ...officialData, isHomebrew: false, source: 'official' } : null;
}
