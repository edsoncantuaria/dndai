// backend/src/services/unifiedDataService.ts
import redisClient from '../database/redis-client.js';
import { AppDataSource } from '../database/data-source.js';
import { HomebrewContent } from '../entities/HomebrewContent.js';
import { User } from '../entities/User.js';
import crypto from 'crypto';
import { Brackets, Raw } from 'typeorm';

// --- Importação compatível com qualquer modo ESM/TS ---
import * as DndApiModule from './dndApiService.js';
const DndApi = DndApiModule.default || DndApiModule.DndApi || DndApiModule;

// Log de debug
console.log('[UnifiedDataService] Using DndApi mode:', Object.keys(DndApi || {}));


const repo = () => AppDataSource.getRepository(HomebrewContent);
const userRepo = () => AppDataSource.getRepository(User);
const localHexCache = new Map<number, string>();

const norm = (s?: string) => (s ?? '').toLowerCase().trim();
const globalKey = (r: string, i?: string) => i ? `dnd5e:v2014:${r}:${i}` : `dnd5e:v2014:${r}:list`;
const userKey = (uid: number, hex: string, r: string, i?: string) =>
  i ? `user:${uid}:${hex}:${r}:${i}` : `user:${uid}:${hex}:${r}:list`;

const TYPE_MAP: Record<string, string> = {
  equipment: 'item',
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
  const key = globalKey(resource, index);
  const useCache = redisClient && redisClient.isOpen;

  if (useCache) {
    try {
      const cached = await redisClient.get(key);
      if (cached && cached !== 'null' && cached !== '{}') {
        console.log(`[dndApiService-Cache] HIT detalhes: ${key}`);
        return JSON.parse(cached);
      }
    } catch (err) {
      console.error(`[Cache] Erro ao ler chave ${key}:`, err);
    }
  }

  // Mesmo esquema de fallback seguro
  const getDetailsFn =
    DndApi.getDetails ||
    DndApi.getResourceDetails ||
    (typeof DndApi === 'function' ? DndApi : null);

  if (!getDetailsFn) {
    throw new Error('[UnifiedDataService] Erro: DndApi.getDetails não está definido.');
  }

  const data = await getDetailsFn.call(DndApi, resource, index);

  if (useCache && data) {
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
        const key = norm(content.official_index || content.index || hb.name);
        
        if (map.has(key)) {
          const officialItem = map.get(key);
          const mergedContent = { ...officialItem, ...content, name: content.name || officialItem.name, desc: content.desc || officialItem.desc };
          map.set(key, { ...mergedContent, source: 'homebrew', isHomebrew: true }); // Garante a source
        } else {
          map.set(key, { ...content, isHomebrew: true, source: 'homebrew', id: hb.id });
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

  // Aplica tradução se houver
  if(officialData) {
      const translation = await repo().findOne({
        where: {
            type: 'translation',
            authorId: 1, // Apenas traduções do sistema
            content: Raw(alias => `JSON_UNQUOTE(JSON_EXTRACT(${alias}, '$.official_index')) = :index`, { index: normalizedIndex })
        }
      });
      if(translation) {
          const content = typeof translation.content === 'string' ? JSON.parse(translation.content) : translation.content;
          officialData = { ...officialData, ...content, name: content.name || officialData.name, desc: content.desc || officialData.desc };
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
             sqb.where("hb.id = :index", { index: normalizedIndex })
                .orWhere("JSON_UNQUOTE(JSON_EXTRACT(hb.content, '$.index')) = :index", { index: normalizedIndex })
                .orWhere("JSON_UNQUOTE(JSON_EXTRACT(hb.content, '$.official_index')) = :index", { index: normalizedIndex });
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
    const finalData = officialData ? { ...officialData, ...content, name: content.name || officialData.name, desc: content.desc || officialData.desc } : content;
    return { ...finalData, isHomebrew: true, source: 'homebrew', id: homebrew.id };
  }

  return officialData ? { ...officialData, isHomebrew: false, source: 'official' } : null;
}
