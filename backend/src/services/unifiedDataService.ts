// backend/src/services/unifiedDataService.ts
import redisClient from '../database/redis-client.js';
import { AppDataSource } from '../database/data-source.js';
import { HomebrewContent } from '../entities/HomebrewContent.js';
import { User } from '../entities/User.js';
import { DndApi } from './dndApiService.js';
import crypto from 'crypto';
import { Brackets } from 'typeorm';

const repo = () => AppDataSource.getRepository(HomebrewContent);
const userRepo = () => AppDataSource.getRepository(User);

const norm = (s?: string) => (s ?? '').toLowerCase().trim();
const globalKey = (r: string, i?: string) => i ? `dnd5e:${r}:${i}` : `dnd5e:${r}:list`;
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
    console.log(`[UnifiedService] Novo HEX gerado para usuário ${userId}: ${user.homebrewCacheHex}`);
  }
  return user.homebrewCacheHex;
}

/**
 * Invalida o cache do usuário, forçando a regeneração do HEX.
 */
export async function invalidateUserCache(userId: number) {
  const user = await userRepo().findOne({ where: { id: userId } });
  if (!user) return;
  user.homebrewCacheHex = crypto.randomBytes(6).toString('hex');
  await userRepo().save(user);
  console.log(`[UnifiedService] Cache do usuário ${userId} invalidado. Novo HEX: ${user.homebrewCacheHex}`);
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
        // VALIDAÇÃO: Se o cache existe mas está vazio, considera 'miss'
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log(`[dndApiService-Cache] HIT para chave: ${listKey}`);
          return parsed;
        } else {
          console.log(`[dndApiService-Cache] Cache VÁZIO ou INVÁLIDO encontrado para ${listKey}. Buscando novamente.`);
        }
      }
    } catch (err) {
      console.error(`[Cache] Erro ao ler chave ${listKey}:`, err);
    }
  }

  console.log(`[dndApiService-Cache] MISS para chave: ${listKey}. Buscando da API...`);
  const data = await DndApi.getResourceList(resource);

  // VALIDAÇÃO: Só salva no cache se a resposta for válida e tiver conteúdo.
  if (redisClient && redisClient.isOpen && data && Array.isArray(data.results) && data.results.length > 0) {
    await redisClient.set(listKey, JSON.stringify(data.results));
    console.log(`[Cache] SET para chave: ${listKey}`);
  }
  return data?.results || [];
}

/**
 * Busca detalhes oficiais, validando o cache.
 */
async function getOfficialDetails(resource: string, index: string): Promise<any | null> {
  const key = globalKey(resource, index);
  if (redisClient && redisClient.isOpen) {
    try {
      const cached = await redisClient.get(key);
      // VALIDAÇÃO: Se o cache existe mas está 'null' ou é um objeto vazio, ignora.
      if (cached && cached !== 'null' && cached !== '{}') {
        console.log(`[dndApiService-Cache] HIT para chave: ${key}`);
        return JSON.parse(cached);
      }
    } catch (err) {
      console.error(`[Cache] Erro ao ler chave ${key}:`, err);
    }
  }
  console.log(`[dndApiService-Cache] MISS para chave: ${key}. Buscando da API...`);
  const data = await DndApi.getDetails(resource, index);

  // VALIDAÇÃO: Só salva no cache se a resposta for válida.
  if (redisClient && redisClient.isOpen && data) {
    await redisClient.set(key, JSON.stringify(data));
    console.log(`[Cache] SET para chave: ${key}`);
  }
  return data;
}

/**
 * Monta lista unificada (Oficial + Homebrew).
 */
export async function getUnifiedList(resource: string, userId?: number): Promise<any[]> {
  const normalizedResource = norm(resource);
  const dbType = TYPE_MAP[normalizedResource] || normalizedResource;
  console.log(`[UnifiedService] Iniciando getUnifiedList para resource: '${resource}', userId: ${userId}`);

  const officialList = await getOfficialList(normalizedResource);
  console.log(`[UnifiedService] API Oficial retornou ${officialList.length} itens.`);

  if (!userId) return officialList;

  const hex = await ensureUserHex(userId);
  const uKey = userKey(userId, hex, normalizedResource);

  if (redisClient && redisClient.isOpen) {
    const cachedUser = await redisClient.get(uKey);
    if (cachedUser) {
      console.log(`[UnifiedService] Cache de usuário HIT: ${uKey}`);
      return JSON.parse(cachedUser);
    }
     console.log(`[UnifiedService] Cache de usuário MISS: ${uKey}`);
  }

  const user = await userRepo().findOne({ where: { id: userId }, select: ['installedHomebrewIds'] });
  const installedIds = user?.installedHomebrewIds || [];

  const qb = repo().createQueryBuilder('hb');
  qb.where('LOWER(hb.type) = :type', { type: dbType })
    .andWhere(new Brackets(sqb => {
      sqb.where('hb.isPublic = :pub', { pub: true });
      if (installedIds.length > 0) {
        // CORREÇÃO: Busca por ID do conteúdo OU por ID do pacote.
        sqb.orWhere('hb.id IN (:...ids)', { ids: installedIds });
        sqb.orWhere('hb.bundleId IN (:...ids)', { ids: installedIds });
      }
    }));

  const homebrews = await qb.getMany();
  const translations = await repo().find({ where: { type: 'translation', authorId: 1 }});
  console.log(`[UnifiedService] Query de Homebrew retornou ${homebrews.length} itens do tipo '${dbType}' e ${translations.length} itens de tradução.`);

  const map = new Map<string, any>();
  for (const item of officialList) {
    map.set(norm(item.index), { ...item, isHomebrew: false, source: 'official' });
  }

  let overwritten = 0, added = 0;
  for (const hb of homebrews) {
    const content = typeof hb.content === 'string' ? JSON.parse(hb.content) : hb.content;
    const key = norm(content.official_index || content.index);
    
    if (map.has(key)) {
      overwritten++;
      const officialItem = map.get(key);
      const mergedContent = { ...officialItem, ...content, name: content.name || officialItem.name, desc: content.desc || officialItem.desc };
      map.set(key, { ...mergedContent, isHomebrew: true, source: 'homebrew' });
    } else {
      added++;
      map.set(key, { ...content, isHomebrew: true, source: 'homebrew', id: hb.id });
    }
  }

  console.log(`[UnifiedService] Sobrescrevendo ${overwritten} oficiais e adicionando ${added} novos homebrew.`);

  const merged = Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  console.log(`[UnifiedService] Mesclagem concluída. Total de itens: ${merged.length}.`);

  if (redisClient && redisClient.isOpen && merged.length > 0) {
    await redisClient.set(uKey, JSON.stringify(merged));
    console.log(`[Cache] SET persistente usuário: ${uKey}`);
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
  const homebrewRepo = repo();

  let homebrew: HomebrewContent | null = null;

  // 1. Tenta buscar homebrew pelo ID (UUID)
  if (normalizedIndex.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/)) {
    homebrew = await homebrewRepo.findOneBy({ id: normalizedIndex, type: dbType as any });
  }
  
  // 2. Se não encontrou por UUID, tenta buscar pelo `official_index` ou `index` do conteúdo
  if (!homebrew && userId) {
      const user = await userRepo().findOne({ where: { id: userId }, select: ['installedHomebrewIds'] });
      const installedIds = user?.installedHomebrewIds || [];
      
      const qb = homebrewRepo.createQueryBuilder('hb');
      qb.where('LOWER(hb.type) = :type', { type: dbType })
        .andWhere(
           new Brackets(sqb => {
                sqb.where("JSON_UNQUOTE(JSON_EXTRACT(hb.content, '$.official_index')) = :index", { index: normalizedIndex })
                   .orWhere("JSON_UNQUOTE(JSON_EXTRACT(hb.content, '$.index')) = :index", { index: normalizedIndex })
            })
        )
        .andWhere(new Brackets(sqb => {
            sqb.where('hb.isPublic = :pub', { pub: true });
            if (installedIds.length > 0) {
                sqb.orWhere('hb.id IN (:...ids)', { ids: installedIds });
                sqb.orWhere('hb.bundleId IN (:...ids)', { ids: installedIds });
            }
        }))
        .orderBy('hb.authorId', 'DESC'); // Prioriza o conteúdo do usuário (maior ID) sobre o do admin (ID 1)
        
      homebrew = await qb.getOne();
  }


  const officialData = await getOfficialDetails(normalizedResource, normalizedIndex);

  if (homebrew) {
    const content = typeof homebrew.content === 'string' ? JSON.parse(homebrew.content) : homebrew.content;
    // Se existe dado oficial, mescla; senão, usa apenas o homebrew.
    const finalData = officialData ? { ...officialData, ...content, name: content.name || officialData.name, desc: content.desc || officialData.desc } : content;
    return { ...finalData, isHomebrew: true, source: 'homebrew', id: homebrew.id };
  }

  if (officialData) {
    return { ...officialData, isHomebrew: false, source: 'official' };
  }

  return null;
}
