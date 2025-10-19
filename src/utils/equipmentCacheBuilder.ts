
// src/utils/equipmentCacheBuilder.ts
import type { InventoryItem } from '@/types';
import * as DndApiService from '@/services/dndApiService';

/**
 * 🔹 Normaliza uma string em formato de chave
 * Ex: "Holy Symbols" -> "holy-symbols"
 */
export const normalizeKey = (str: string): string =>
  str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/--+/g, '-')
    .trim();

/**
 * 🔹 Cria um cache global de equipamentos categorizados
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
    'musical-instruments': ['musical instrument', 'instrumentos musicais', 'any other musical instrument'],
    'arcane-foci': ['arcane focus', 'foco arcano', 'arcane focuses'],
    'druidic-foci': ['druidic focus', 'foco druídico', 'druidic focuses'],
    'shield': ['shields', 'any shield', 'escudo', 'a shield'],
  };

  for (const item of equipmentList) {
    if (!item) continue;

    const name = item.name.toLowerCase();
    const index = item.index.toLowerCase();
    const baseCats = [
      item.equipment_category?.index,
      (item as any).gear_category?.index,
      item.weapon_category,
      item.armor_category,
    ].filter(Boolean) as string[];

    if (baseCats.length) add(baseCats, item);

    // 🔸 Armas
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

    // Itens específicos
    if (
      index.includes('holy-symbol') ||
      name.includes('holy symbol') ||
      item.equipment_category?.index === 'holy-symbols'
    ) {
      add(['holy-symbols'], item);
    }
    if (index.match(/(crystal|orb|rod|staff|wand)/)) {
      add(['arcane-foci'], item);
    }
    if (index.match(/(mistletoe|totem|wooden-staff|yew-wand)/)) {
      add(['druidic-foci'], item);
    }
    if (name.includes('shield')) {
      add(['shield'], item);
    }
    if (item.equipment_category?.index === 'adventuring-gear') {
      add(['gear', 'adventuring gear'], item);
    }
  }

  // 🔹 Agrupamentos compostos
  const simpleWeapons = equipmentList.filter(i => i.weapon_category === 'Simple');
  const martialWeapons = equipmentList.filter(i => i.weapon_category === 'Martial');
  add(['simple-weapons'], ...simpleWeapons);
  add(['martial-weapons'], ...martialWeapons);

  // 🔹 Cria aliases explícitos
  for (const [base, aliases] of Object.entries(ALIASES)) {
    const baseKey = normalizeKey(base);
    if (!cache[baseKey]) continue;
    for (const alias of aliases) {
      const aliasKey = normalizeKey(alias);
      if (!cache[aliasKey]) {
        cache[aliasKey] = cache[baseKey];
      }
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
    if (category?.equipment) return category.equipment as InventoryItem[];
  } catch (err) {
    console.warn(`[EquipmentCache] Fallback falhou para categoria: ${nk}`);
  }

  return [];
}
