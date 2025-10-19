// src/utils/equipmentCacheBuilder.ts
import type { InventoryItem } from '@/types';
import * as DndApiService from '@/services/dndApiService';
import { fetchDetailsInChunks } from './apiUtils';

export const normalizeKey = (str: string): string =>
  String(str ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/--+/g, '-')
    .trim();

export const findCacheMatch = (key: string, cache: Record<string, any[]>): string | null => {
    if (!key || !cache) return null;
    const nk = normalizeKey(key);
    const keys = Object.keys(cache);
    if (keys.includes(nk)) return nk;
    const variants = [nk, nk.replace(/s$/, ''), nk + 's', nk.replace(/-weapons$/, '-weapon'), nk.replace(/-weapon$/, '-weapons')];
    for (const v of variants) if (keys.includes(v)) return v;
    return keys.find(k => k.includes(nk) || nk.includes(k)) ?? null;
};

export async function buildEquipmentCache(): Promise<Record<string, InventoryItem[]>> {
  const equipmentListResponse = await DndApiService.getResourceList('equipment');
  const equipmentList = equipmentListResponse?.results || [];

  if (!Array.isArray(equipmentList)) throw new Error('Lista de equipamentos inválida.');

  const allEquipmentDetails = await fetchDetailsInChunks(
    equipmentList,
    (index) => DndApiService.getEquipmentDetails(index),
    () => {} // No progress reporting needed here
  );

  const cache: Record<string, InventoryItem[]> = {};

  const add = (keys: string[], ...items: InventoryItem[]) => {
    for (const k0 of keys) {
      const k = normalizeKey(k0);
      if (!k) continue;
      if (!cache[k]) cache[k] = [];
      for (const it of items) {
        if (!it?.index) continue;
        if (!cache[k].some((e) => e.index === it.index)) cache[k].push(it);
      }
    }
  };

  const ALIASES: Record<string, string[]> = {
    'holy-symbols': ['holy-symbol', 'holy symbols', 'holy symbol', 'símbolos sagrados', 'símbolo sagrado', 'símbolo'],
    'simple-weapons': ['simple-weapon', 'armas simples'],
    'martial-weapons': ['martial-weapon', 'armas marciais'],
    'musical-instruments': ['musical-instrument', 'instrumentos musicais', 'any other musical instrument'],
    'arcane-foci': ['arcane-focus', 'foco arcano', 'arcane focuses'],
    'druidic-foci': ['druidic-focus', 'foco druídico', 'druidic focuses'],
    shield: ['shields', 'a-shield', 'any-shield', 'escudo'],
  };

  // Passo 1: indexar tudo que vier da lista detalhada
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

    if (/(crystal|orb|rod|staff|wand)/i.test(index))
      add(['arcane-foci', 'arcane-focus'], item);

    if (/(mistletoe|totem|wooden-staff|yew-wand)/i.test(index))
      add(['druidic-foci', 'druidic-focus'], item);

    if (item.weapon_category === 'Simple') add(['simple-weapons'], item);
    if (item.weapon_category === 'Martial') add(['martial-weapons'], item);

    if (item.equipment_category?.index === 'adventuring-gear') add(['gear', 'adventuring gear'], item);

    if (
      item.equipment_category?.index === 'musical-instruments' ||
      item.equipment_category?.index === 'musical-instrument'
    ) {
      add(['musical-instruments', 'musical-instrument', 'any other musical instrument'], item);
    }

    if (
      index.includes('holy-symbol') ||
      name.includes('holy symbol') ||
      ['amulet', 'emblem', 'reliquary'].includes(index) ||
      item.equipment_category?.index === 'holy-symbols' ||
      (item as any).gear_category?.index === 'holy-symbols'
    ) {
      add(['holy-symbols', 'holy-symbol'], item);
    }
  }

  // Passo 2: garantir que as categorias críticas tenham itens (fallback)
  async function ensureCategory(key: string) {
    const nk = normalizeKey(key);
    const has = cache[nk]?.length;
    if (has) return;

    try {
      const details = await DndApiService.getEquipmentCategoryDetails(nk);
      const raw = (details?.equipment || details?.results || []) as Array<{ index: string; name: string; url?: string }>;
      const items = raw
        .filter(Boolean)
        .map((i) => ({ index: i.index, name: i.name, url: i.url ?? `/api/data/equipment/${i.index}` })) as InventoryItem[];
      
      const detailedItems = await fetchDetailsInChunks(items, DndApiService.getEquipmentDetails, () => {});

      if (detailedItems.length) add([nk], ...detailedItems.filter((i): i is InventoryItem => !!i));
    } catch {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[EquipmentCache] Fallback falhou para categoria: ${nk}`);
      }
    }
  }

  await Promise.all([
    ensureCategory('holy-symbols'),
    ensureCategory('simple-weapons'),
    ensureCategory('martial-weapons'),
    ensureCategory('musical-instruments'),
  ]);

  // Passo 3: aliases explícitos
  for (const [base, aliases] of Object.entries(ALIASES)) {
    const baseKey = normalizeKey(base);
    const list = cache[baseKey];
    if (!list?.length) continue;
    for (const alias of aliases) cache[normalizeKey(alias)] = list;
  }

  return cache;
}

export async function resolveEquipmentCategory(
  key: string,
  cache: Record<string, InventoryItem[]>
): Promise<InventoryItem[]> {
  const nk = normalizeKey(key);
  if (cache[nk]?.length) return cache[nk];

  try {
    const category = await DndApiService.getEquipmentCategoryDetails(nk);
    const rawItems = (category?.equipment || category?.results || []) as Array<{ index: string; name: string; url?: string }>;

    if (rawItems.length > 0) {
        const detailedItems = await fetchDetailsInChunks(rawItems, DndApiService.getEquipmentDetails, () => {});
        const validItems = detailedItems.filter((i): i is InventoryItem => !!i);
        if (validItems.length > 0) {
            cache[nk] = validItems;
            return validItems;
        }
    }
  } catch (err: any) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[EquipmentCache] Fallback falhou: ${nk} (${err?.message})`);
    }
  }

  return [];
}
