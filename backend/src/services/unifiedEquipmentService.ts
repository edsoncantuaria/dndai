// backend/src/services/unifiedEquipmentService.ts
import { getResourceList, getDetails } from './dndApiService.js';
import redisClient from '../database/redis-client.js';
import { HomebrewContent } from '../entities/HomebrewContent.js';
import { AppDataSource } from '../database/data-source.js';

/**
 * Busca, unifica e cacheia todos os equipamentos do D&D 5e API com o conteúdo homebrew.
 * @returns Uma lista unificada de todos os equipamentos.
 */
export async function getUnifiedEquipment() {
  const cacheKey = 'dnd5e:unified-equipment';
  
  if (redisClient && redisClient.isOpen) {
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
            console.log('[Cache] HIT: Retornando equipamentos unificados do cache.');
            return JSON.parse(cached);
        }
      } catch(e) {
          console.error('[Cache] Erro ao ler do Redis:', e);
      }
  }

  console.log('[API Fetch] MISS: Buscando e unificando todos os equipamentos...');

  // 1. Fetch from official API
  const equipmentList = await getResourceList('equipment');
  let officialItems = [];
  if (equipmentList?.results) {
      officialItems = await Promise.all(
          equipmentList.results.map(i => getDetails('equipment', i.index))
      );
  }
  
  // 2. Fetch homebrew content
  const homebrewRepo = AppDataSource.getRepository(HomebrewContent);
  const homebrewItems = await homebrewRepo.find({ where: { type: 'item', isPublic: true } });

  // 3. Merge and unify data
  const unifiedMap = new Map<string, any>();

  // Add official items first
  officialItems.filter(Boolean).forEach(item => {
    unifiedMap.set(item.index, { ...item, source: 'official' });
  });

  // Add homebrew items, overwriting official if index matches
  homebrewItems.forEach(hbItem => {
    const content = hbItem.content;
    if (content && content.index) {
        unifiedMap.set(content.index, { ...content, source: 'homebrew', id: hbItem.id });
    }
  });

  const unified = Array.from(unifiedMap.values());

  // 4. Cache in Redis
  if (redisClient && redisClient.isOpen) {
    try {
        // Cache por 24 horas
        await redisClient.set(cacheKey, JSON.stringify(unified), { EX: 86400 });
        console.log('[Cache] SET: Equipamentos unificados salvos no cache.');
    } catch(e) {
        console.error('[Cache] Erro ao salvar no Redis:', e);
    }
  }

  return unified;
}
