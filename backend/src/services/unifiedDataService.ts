// backend/src/services/unifiedDataService.ts
import redisClient from '../database/redis-client.js';
import { AppDataSource } from '../database/data-source.js';
import { HomebrewContent } from '../entities/HomebrewContent.js';
import { User } from '../entities/User.js';
import DndApi from './dndApiService.js';
import crypto from 'crypto';
import { Brackets, Raw } from 'typeorm';

const repo = () => AppDataSource.getRepository(HomebrewContent);
const userRepo = () => AppDataSource.getRepository(User);

const norm = (s?: string) => (s ?? '').toLowerCase().trim();
const globalKey = (r: string, i?: string) => i ? `dnd5e:2014:${r}:${i}` : `dnd5e:2014:${r}:list`;
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
  const user = await userRepo().findOne({ where: { id: userId }, select: ['id', 'homebrewCacheHex'] });
  if (!user) throw new Error('Usuário não encontrado.');
  
  if (!user.homebrewCacheHex) {
    user.homebrewCacheHex = crypto.randomBytes(6).toString('hex');
    await userRepo().save(user);
    console.log(`[Cache] Novo homebrewCacheHex gerado para o usuário ${userId}.`);
  }
  return user.homebrewCacheHex;
}

/**
 * Invalida o cache do usuário. Em uma implementação real, regeneraria o hex.
 */
export async function invalidateUserCache(userId: number) {
    const user = await userRepo().findOne({ where: { id: userId } });
    if (user) {
        user.homebrewCacheHex = crypto.randomBytes(6).toString('hex');
        await userRepo().save(user);
        console.log(`[Cache] Cache invalidado e novo hex gerado para o usuário ${userId}.`);
    }
}

/**
 * Busca lista oficial, validando o cache.
 */
async function getOfficialList(resource: string): Promise<any[]> {
  const listKey = globalKey(resource);
  if (redisClient && redisClient.isOpen) {
    try {
      const cached = await redisClient.get(listKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log(`[dndApiService-Cache] HIT para chave: ${listKey}`);
          return parsed;
        }
      }
    } catch (err) {
      console.error(`[Cache] Erro ao ler chave ${listKey}:`, err);
    }
  }

  const data = await DndApi.getResourceList(resource);
  const results = data || [];

  if (redisClient && redisClient.isOpen && results.length > 0) {
    try {
        await redisClient.set(listKey, JSON.stringify(results));
    } catch(err) {
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
  if (redisClient && redisClient.isOpen) {
    try {
      const cached = await redisClient.get(key);
      if (cached && cached !== 'null' && cached !== '{}') {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.error(`[Cache] Erro ao ler chave ${key}:`, err);
    }
  }
  const data = await DndApi.getDetails(resource, index);

  if (redisClient && redisClient.isOpen && data) {
    try {
      await redisClient.set(key, JSON.stringify(data));
    } catch (err) {
       console.error(`[Cache] Falha ao salvar no Redis ${key}:`, err);
    }
  }
  return data || {}; // Retorna objeto vazio em vez de nulo
}


/**
 * Monta lista unificada (Oficial + Homebrew).
 */
export async function getUnifiedList(resource: string, userId?: number): Promise<any[]> {
  const normalizedResource = norm(resource);
  const dbType = TYPE_MAP[normalizedResource] || normalizedResource;
  
  const officialList = await getOfficialList(normalizedResource) || [];

  const map = new Map<string, any>();
  // 1. Oficiais
  for (const item of officialList) {
    if (item && item.index) {
        map.set(norm(item.index), { ...item, isHomebrew: false, source: 'official' });
    }
  }
  
  // 2. Traduções
  const translations = await repo().find({ where: { type: 'translation', authorId: 1 } });
  for (const t of translations) {
      try {
        const content = typeof t.content === 'string' ? JSON.parse(t.content) : t.content;
        const key = norm(content.official_index || content.index);
        if (map.has(key)) {
            const existing = map.get(key);
            // Sobrescreve apenas 'name' e 'desc', mantendo o resto.
            map.set(key, { ...existing, ...content, name: content.name || existing.name, desc: content.desc || existing.desc });
        }
      } catch(e) {
          console.error(`Falha ao aplicar tradução ${t.id}:`, e);
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
        const key = norm(content.official_index || content.index);
        
        if (map.has(key)) {
          const officialItem = map.get(key);
          const mergedContent = { ...officialItem, ...content, name: content.name || officialItem.name, desc: content.desc || officialItem.desc };
          map.set(key, { ...mergedContent, isHomebrew: true, source: 'homebrew' });
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
            content: Raw(alias => `JSON_UNQUOTE(JSON_EXTRACT(${alias}, '$.official_index')) = :index`, { index: normalizedIndex })
        }
      });
      if(translation) {
          const content = typeof translation.content === 'string' ? JSON.parse(translation.content) : translation.content;
          officialData = { ...officialData, ...content };
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
          .orderBy('hb.authorId', 'DESC');
        
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
