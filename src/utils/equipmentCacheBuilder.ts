// src/utils/equipmentCacheBuilder.ts
import type { InventoryItem } from '@/types';
import * as DndApiService from '@/services/dndApiService';

/**
 * 🔹 Normaliza uma string em formato de chave
 * Ex: "Holy Symbols" -> "holy-symbols"
 */
export const normalizeKey = (str: string): string =>
  str
    ?.toLowerCase()
    ?.normalize('NFD')
    ?.replace(/[\u0300-\u036f]/g, '') // remove acentos
    ?.replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    ?.replace(/--+/g, '-')
    ?.trim();

/**
 * 🔹 Cria o cache global de equipamentos categorizados
 */
export async function buildEquipmentCache(): Promise<Record<string, InventoryItem[]>> {
  const equipmentList = await DndApiService.getEquipment();
  if (!Array.isArray(equipmentList)) throw new Error('Lista de equipamentos inválida.');

  const cache: Record<string, InventoryItem[]> = {};
  const add = (keys: string[], ...items: InventoryItem[]) => {
    for (const k of keys.map(normalizeKey)) {
      if (!k) continue;
      if (!cache[k]) cache[k] = [];
      for (const it of items) {
        if (!cache[k].some(e => e.index === it.index)) cache[k].push(it);
      }
    }
  };

  // 🔹 Aliases globais conhecidos
  const ALIASES: Record<string, string[]> = {
    'holy-symbols': ['holy-symbol', 'holy symbols', 'holy symbol', 'símbolos sagrados'],
    'simple-weapons': ['simple-weapon', 'simple weapons', 'simple weapon', 'armas simples'],
    'martial-weapons': ['martial-weapon', 'martial weapons', 'martial weapon', 'armas marciais'],
    'musical-instruments': ['musical instrument', 'instrumentos musicais'],
    'arcane-foci': ['arcane focus', 'foco arcano', 'arcane focuses'],
    'druidic-foci': ['druidic focus', 'foco druídico', 'druidic focuses'],
    'shield': ['shields', 'any shield', 'escudo'],
  };

  for (const item of equipmentList) {
    const name = item.name.toLowerCase();
    const index = item.index.toLowerCase();
    const baseCats = [
      item.equipment_category?.index,
      (item as any).gear_category?.index,
      item.weapon_category,
      item.armor_category,
    ].filter(Boolean) as string[];

    if (baseCats.length) add(baseCats, item);

    // 🔸 Holy symbols
    if (index.includes('holy-symbol') || name.includes('holy symbol')) {
      add(['holy-symbols', 'holy-symbol'], item);
    }

    // 🔸 Arcane focus
    if (index.match(/(crystal|orb|rod|staff|wand)/)) {
      add(['arcane-foci', 'arcane-focus'], item);
    }

    // 🔸 Druidic focus
    if (index.match(/(mistletoe|totem|wooden-staff|yew-wand)/)) {
      add(['druidic-foci', 'druidic-focus'], item);
    }

    // 🔸 Shields
    if (name.includes('shield')) add(['shield', 'shields', 'a-shield', 'any-shield'], item);

    // 🔸 Simple & Martial weapons
    if (item.weapon_category === 'Simple') add(['simple-weapons'], item);
    if (item.weapon_category === 'Martial') add(['martial-weapons'], item);
  }

  // 🔹 Cria aliases explícitos
  for (const [base, aliases] of Object.entries(ALIASES)) {
    if (!cache[normalizeKey(base)]) continue;
    for (const alias of aliases) {
      const nk = normalizeKey(alias);
      cache[nk] = cache[normalizeKey(base)];
    }
  }

  return cache;
}

/**
 * 🔹 Resolve categoria (com fallback dinâmico na API se necessário)
 */
export async function resolveEquipmentCategory(
  key: string,
  cache: Record<string, InventoryItem[]>
): Promise<InventoryItem[]> {
  const nk = normalizeKey(key);
  if (cache[nk]) return cache[nk];

  // Fallback: busca da API se não estiver no cache
  try {
    const category = await DndApiService.getEquipmentCategoryDetails(nk);
    if (category?.equipment) return category.equipment;
  } catch (err) {
    console.warn(`[EquipmentCache] Fallback falhou para categoria: ${nk}`);
  }

  return [];
}
