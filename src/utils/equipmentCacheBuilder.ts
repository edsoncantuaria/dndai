// src/utils/equipmentCacheBuilder.ts
import type { InventoryItem } from '@/types';
import * as DndApiService from '@/services/dndApiService';
import { fetchDetailsInChunks } from './apiUtils';

/**
 * 🔹 Normaliza uma string para formato de chave de cache
 * Ex: "Holy Symbols" → "holy-symbols"
 */
export const normalizeKey = (str: string): string =>
  String(str ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/--+/g, '-')
    .trim();

/** Chave canônica de categoria SRD — sempre preferir `index` ao nome traduzido. */
export function equipmentCategoryKey(
  cat: string | { index?: string; name?: string } | null | undefined,
): string {
  if (!cat) return '';
  if (typeof cat === 'string') return cat;
  return cat.index || cat.name || '';
}

/**
 * 🔹 Tenta encontrar a melhor correspondência de chave no cache
 */
export const findCacheMatch = (key: string, cache: Record<string, any[]>): string | null => {
  if (!key || !cache) return null;
  const nk = normalizeKey(key);
  const keys = Object.keys(cache);

  if (keys.includes(nk)) return nk;

  const variants = [
    nk,
    nk.replace(/s$/, ''),
    nk + 's',
    nk.replace(/-weapons$/, '-weapon'),
    nk.replace(/-weapon$/, '-weapons'),
    nk.replace(/-symbols$/, '-symbol'),
    nk.replace(/-symbol$/, '-symbols'),
  ];

  for (const v of variants) if (keys.includes(v)) return v;

  return keys.find(k => k.includes(nk) || nk.includes(k)) ?? null;
};


/**
 * 🔹 Constrói o cache completo de equipamentos com aliases e fallbacks
 */
export async function buildEquipmentCache(allEquipmentDetails: InventoryItem[]): Promise<Record<string, InventoryItem[]>> {
  console.log(`[EquipmentCache] 📦 Construindo cache com ${allEquipmentDetails.length} itens.`);

  const cache: Record<string, InventoryItem[]> = {};

  const add = (keys: string[], ...items: InventoryItem[]) => {
    for (const key of keys) {
      const nk = normalizeKey(key);
      if (!nk) continue;
      if (!cache[nk]) cache[nk] = [];
      for (const it of items) {
        if (!it?.index) continue;
        if (!cache[nk].some(e => e.index === it.index)) cache[nk].push(it);
      }
    }
  };

  /** Aliases globais conhecidos */
  const ALIASES: Record<string, string[]> = {
    'holy-symbols': ['holy-symbol', 'símbolo sagrado', 'símbolos sagrados', 'símbolo'],
    'simple-weapons': ['simple-weapon', 'armas simples'],
    'martial-weapons': ['martial-weapon', 'armas marciais'],
    'musical-instruments': ['musical-instrument', 'instrumentos musicais'],
    'arcane-foci': ['arcane-focus', 'foco arcano', 'foco mágico'],
    'druidic-foci': ['druidic-focus', 'foco druídico', 'foco natural'],
    'shield': ['shields', 'a-shield', 'any-shield', 'escudo'],
  };

  /** Indexa cada item */
  for (const item of allEquipmentDetails) {
    if (!item) continue;

    const name = item.name?.toLowerCase() ?? '';
    const index = item.index?.toLowerCase() ?? '';

    const categories = [
      item.equipment_category?.index,
      (item as any).gear_category?.index,
      item.weapon_category,
      item.armor_category,
    ].filter(Boolean) as string[];

    if (categories.length) add(categories, item);

    if (item.weapon_category) {
      const w = item.weapon_category.toLowerCase();
      add([`${w}-weapon`, `${w}-weapons`, `${w} weapon`, `any ${w} weapon`], item);
    }

    if (name.includes('shield')) add(['shield', 'shields', 'a-shield', 'any-shield'], item);

    if (/(crystal|orb|rod|staff|wand)/i.test(index)) add(['arcane-foci', 'arcane-focus'], item);
    if (/(mistletoe|totem|wooden-staff|yew-wand)/i.test(index)) add(['druidic-foci', 'druidic-focus'], item);

    if (item.weapon_category === 'Simple') add(['simple-weapons'], item);
    if (item.weapon_category === 'Martial') add(['martial-weapons'], item);

    if (item.equipment_category?.index === 'adventuring-gear')
      add(['gear', 'adventuring gear'], item);

    if (
      item.equipment_category?.index === 'musical-instruments' ||
      item.equipment_category?.index === 'musical-instrument'
    ) {
      add(['musical-instruments', 'musical-instrument', 'any musical instrument'], item);
    }

    if (
      index.includes('holy-symbol') ||
      name.includes('holy symbol') ||
      ['amulet', 'emblem', 'reliquary'].includes(index)
    ) {
      add(['holy-symbols', 'holy-symbol'], item);
    }
  }

  /** 🔹 Fallbacks críticos (caso a API retorne incompleto) */
  async function ensureCategory(key: string) {
    const nk = normalizeKey(key);
    const has = cache[nk]?.length;
    if (has) return;

    try {
      const details = await DndApiService.getEquipmentCategoryDetails(nk);
      const raw = (details?.equipment || details?.results || []) as Array<{ index: string; name: string; url?: string }>;
      const items = raw.map(i => ({ index: i.index, name: i.name, url: i.url })) as InventoryItem[];
      const detailedItems = await fetchDetailsInChunks(items, DndApiService.getEquipmentDetails, () => {});
      if (detailedItems.length) add([nk], ...detailedItems);
    } catch {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[EquipmentCache] Falha no fallback da categoria: ${nk}`);
      }
    }
  }

  await Promise.all([
    ensureCategory('holy-symbols'),
    ensureCategory('simple-weapons'),
    ensureCategory('martial-weapons'),
    ensureCategory('musical-instruments'),
  ]);

  /** 🔹 Cria aliases equivalentes */
  for (const [base, aliases] of Object.entries(ALIASES)) {
    const baseKey = normalizeKey(base);
    const list = cache[baseKey];
    if (!list?.length) continue;
    for (const alias of aliases) cache[normalizeKey(alias)] = list;
  }
  
  console.log(`[✅ Equipment Cache Built] Cache reconstruído com ${Object.keys(cache).length} categorias indexadas.`);


  return cache;
}

/**
 * 🔹 Resolve uma categoria a partir do cache, com fallback à API
 */
export async function resolveEquipmentCategory(
  key: string,
  cache: Record<string, InventoryItem[]>
): Promise<InventoryItem[]> {
  const nk = normalizeKey(key);
  const cacheKey = findCacheMatch(nk, cache);
  
  if (cacheKey && cache[cacheKey]?.length > 0) {
      console.log(`[resolveEquipmentCategory] Cache HIT for key: "${key}" (found as "${cacheKey}")`);
      return cache[cacheKey];
  }

  try {
    const category = await DndApiService.getEquipmentCategoryDetails(nk);
    const rawItems = (category?.equipment || category?.results || []) as Array<{ index: string; name: string; url?: string }>;
    if (!rawItems.length) return [];

    const detailedItems = await fetchDetailsInChunks(rawItems, DndApiService.getEquipmentDetails, () => {});
    const validItems = detailedItems.filter((i): i is InventoryItem => !!i);
    if (validItems.length > 0) {
      cache[nk] = validItems;
      return validItems;
    }
  } catch (err: any) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[EquipmentCache] Fallback falhou: ${nk} (${err?.message})`);
    }
  }

  return [];
}
