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
 * - Se o usuário não tem, cria um automaticamente.
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
 * Limpa todos os caches antigos do usuário (usado quando ele instala/desinstala homebrews).
 */
export async function invalidateUserCache(userId: number) {
  const user = await userRepo().findOne({ where: { id: userId } });
  if (!user) return;
  user.homebrewCacheHex = crypto.randomBytes(6).toString('hex');
  await userRepo().save(user);
  console.log(`[UnifiedService] Cache do usuário ${userId} invalidada. Novo HEX: ${user.homebrewCacheHex}`);
}

/**
 * Busca lista oficial (usando cache global).
 */
async function getOfficialList(resource: string) {
  const listKey = globalKey(resource);
  if (redisClient && redisClient.isOpen) {
    const cached = await redisClient.get(listKey);
    if (cached) return JSON.parse(cached);
  }
  const data = await DndApi.getResourceList(resource);
  if (redisClient && redisClient.isOpen && data) {
    await redisClient.set(listKey, JSON.stringify(data.results || []));
  }
  return data?.results || [];
}

/**
 * Busca detalhes oficiais (usando cache global).
 */
async function getOfficialDetails(resource: string, index: string) {
  const key = globalKey(resource, index);
  if (redisClient && redisClient.isOpen) {
    const cached = await redisClient.get(key);
    if (cached) return JSON.parse(cached);
  }
  const data = await DndApi.getResourceDetails(resource, index);
  if (redisClient && redisClient.isOpen && data) {
    await redisClient.set(key, JSON.stringify(data));
  }
  return data;
}

/**
 * Monta lista unificada (Oficial + Homebrew).
 */
export async function getUnifiedList(resource: string, userId?: number): Promise<any[]> {
  const normalizedResource = norm(resource);
  const dbType = TYPE_MAP[normalizedResource] || normalizedResource;
  console.log(`[UnifiedService] Iniciando getUnifiedList(${resource}) userId=${userId}`);

  const officialList = await getOfficialList(normalizedResource);

  if (!userId) return officialList; // visitante anônimo

  const hex = await ensureUserHex(userId);
  const uKey = userKey(userId, hex, normalizedResource);

  // 1️⃣ tenta cache do usuário
  if (redisClient && redisClient.isOpen) {
    const cachedUser = await redisClient.get(uKey);
    if (cachedUser) {
      console.log(`[UnifiedService] Cache de usuário HIT: ${uKey}`);
      return JSON.parse(cachedUser);
    }
  }

  // 2️⃣ se não tem cache do usuário, busca homebrews instalados
  const user = await userRepo().findOne({ where: { id: userId }, select: ['installedHomebrewIds'] });
  const installedIds = user?.installedHomebrewIds || [];

  const qb = repo().createQueryBuilder('hb');
  qb.where('LOWER(hb.type) = :type', { type: dbType })
    .andWhere(new Brackets(sqb => {
      sqb.where('hb.isPublic = :pub', { pub: true });
      if (installedIds.length > 0) sqb.orWhere('hb.id IN (:...ids)', { ids: installedIds });
    }));

  const homebrews = await qb.getMany();
  console.log(`[UnifiedService] Encontrados ${homebrews.length} homebrews (${dbType}).`);

  // 3️⃣ faz o merge
  const map = new Map<string, any>();
  for (const item of officialList) {
    map.set(norm(item.index), { ...item, isHomebrew: false });
  }

  let overwritten = 0, added = 0;
  for (const hb of homebrews) {
    const content = typeof hb.content === 'string' ? JSON.parse(hb.content) : hb.content;
    const key = norm(content.official_index || content.index);
    if (map.has(key)) {
      overwritten++;
      map.set(key, { ...map.get(key), ...content, isHomebrew: true, source: 'homebrew' });
    } else {
      added++;
      map.set(key, { ...content, isHomebrew: true, source: 'homebrew' });
    }
  }

  const merged = Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  console.log(`[UnifiedService] Merge finalizado (${overwritten} sobrescritos, ${added} novos). Total ${merged.length}.`);

  if (redisClient && redisClient.isOpen) {
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

  // 1️⃣ tenta homebrew direto (pelo ID)
  const homebrewRepo = repo();
  const homebrew = await homebrewRepo.findOne({
    where: { id: normalizedIndex },
  });

  if (homebrew) {
    const content = typeof homebrew.content === 'string' ? JSON.parse(homebrew.content) : homebrew.content;
    const officialIndex = content.official_index || null;
    const officialData = officialIndex ? await getOfficialDetails(normalizedResource, officialIndex) : {};
    return { ...officialData, ...content, isHomebrew: true, source: 'homebrew' };
  }

  // 2️⃣ tenta oficial
  const official = await getOfficialDetails(normalizedResource, normalizedIndex);
  if (official) return { ...official, isHomebrew: false, source: 'official' };

  return null;
}
