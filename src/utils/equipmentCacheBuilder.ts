// src/utils/equipmentCacheBuilder.ts
import type { InventoryItem } from '@/types';
import * as DndApiService from '@/services/dndApiService';

export const normalizeKey = (str: string): string =>
  String(str ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/--+/g, '-')
    .trim();

export async function buildEquipmentCache(): Promise<Record<string, InventoryItem[]>> {
  const equipmentList = await DndApiService.getEquipment();
  if (!Array.isArray(equipmentList)) throw new Error('Lista de equipamentos inválida.');

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

  // Passo 1: indexar tudo que vier da lista base
  for (const item of equipmentList) {
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

    // Armas
    if (item.weapon_category) {
      const w = item.weapon_category.toLowerCase();
      add(
        [
          `${w}-weapon`,
          `${w}-weapons`,
          `${w} weapon`,
          `${w} weapons`,
          `any ${w} weapon`,
          `any ${w} weapons`,
        ],
        item
      );
    }

    // Escudos
    if (name.includes('shield')) {
      add(['shield', 'shields', 'a shield', 'any shield'], item);
    }

    // Símbolos Sagrados
    if (
      index.includes('holy-symbol') ||
      name.includes('holy symbol') ||
      ['amulet', 'emblem', 'reliquary'].includes(index) ||
      item.equipment_category?.index === 'holy-symbols' ||
      (item as any).gear_category?.index === 'holy-symbols'
    ) {
      add(['holy-symbols', 'holy-symbol'], item);
    }

    // Focos Arcanos
    if (/(crystal|orb|rod|staff|wand)/i.test(index))
      add(['arcane-foci', 'arcane-focus'], item);

    // Focos Druidicos
    if (/(mistletoe|totem|wooden-staff|yew-wand)/i.test(index))
      add(['druidic-foci', 'druidic-focus'], item);

    // Armas corpo a corpo e à distância
    if (item.weapon_range === 'Melee') {
      add(
        [
          'melee-weapon',
          'melee-weapons',
          'melee weapon',
          'simple melee weapon',
          'martial melee weapon',
          'any melee weapon',
        ],
        item
      );
    }
    if (item.weapon_range === 'Ranged') {
      add(
        [
          'ranged-weapon',
          'ranged-weapons',
          'ranged weapon',
          'simple ranged weapon',
          'martial ranged weapon',
          'any ranged weapon',
        ],
        item
      );
    }

    // Equipamento de aventureiro
    if (item.equipment_category?.index === 'adventuring-gear') {
      add(['gear', 'adventuring gear'], item);
    }

    // Instrumentos Musicais
    if (
      item.equipment_category?.index === 'musical-instruments' ||
      item.equipment_category?.index === 'musical-instrument'
    ) {
      add(['musical-instruments', 'musical-instrument', 'any other musical instrument'], item);
    }
  }

  // Passo 2: garantir que as categorias críticas tenham itens
  async function ensureCategory(key: string) {
    const nk = normalizeKey(key);
    const has = cache[nk]?.length;
    if (has) return;

    try {
      const details = await DndApiService.getEquipmentCategoryDetails(nk);
      const raw = (details?.equipment || details?.results || []) as Array<{ index: string; name: string; url?: string }>;
      const items: InventoryItem[] = raw
        .filter(Boolean)
        .map((i) => ({ index: i.index, name: i.name, url: i.url ?? `/api/2014/equipment/${i.index}` })) as InventoryItem[];
      if (items.length) add([nk], ...items);
    } catch {
      // silencioso em prod; se quiser, log em dev
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

  if (process.env.NODE_ENV === 'development') {
    console.groupCollapsed('%c[✅ Equipment Cache]', 'color:#7fffd4');
    console.log('Categorias:', Object.keys(cache));
    console.log('holy-symbols:', cache['holy-symbols']?.map((i) => i.name));
    console.groupEnd();
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
    const raw = (category?.equipment || category?.results || []) as Array<{ index: string; name: string; url?: string }>;
    const list: InventoryItem[] = raw
      .filter(Boolean)
      .map((i) => ({ index: i.index, name: i.name, url: i.url ?? `/api/2014/equipment/${i.index}` })) as InventoryItem[];
    if (list.length) cache[nk] = list;
    return list;
  } catch {
    return [];
  }
}
