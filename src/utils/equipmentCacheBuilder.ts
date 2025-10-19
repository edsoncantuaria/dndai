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
  
  // CORREÇÃO: A função `add` agora itera corretamente sobre múltiplos itens.
  const add = (keys: string[], ...items: InventoryItem[]) => {
    keys.forEach((k) => {
      const nk = normalizeKey(k);
      if (!nk) return;
      if (!cache[nk]) cache[nk] = [];
      for (const it of items) {
        if (!cache[nk].some(e => e.index === it.index)) {
            cache[nk].push(it);
        }
      }
    });
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
    if (!item) continue;

    const name = item.name.toLowerCase();
    const index = item.index.toLowerCase();
    const baseCats = [
      item.equipment_category?.index,
      (item as any).gear_category?.index,
      item.weapon_category,
      item.armor_category,
    ]
      .filter(Boolean)
      .map(String);

    if (baseCats.length) add(baseCats, item);

    // 🔸 Aliases universais para armas
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
        add(['shield', 'shields', 'a-shield', 'any-shield'], item);
    }

    // Símbolos sagrados
    if (
      index.includes('holy-symbol') ||
      name.includes('holy symbol') ||
      name.includes('amuleto') ||
      name.includes('emblema') ||
      name.includes('relicário')
    ) {
      add(['holy-symbol', 'holy-symbols'], item);
    }

    // Focos arcanos
    if (index.match(/(crystal|orb|rod|staff|wand)/i)) {
      add(['arcane-foci', 'arcane-focus', 'an-arcane-focus'], item);
    }

    // Focos druidicos
    if (index.match(/(mistletoe|totem|wooden-staff|yew-wand)/i)) {
      add(['druidic-foci', 'druidic-focus'], item);
    }
    
    // Armas corpo a corpo e à distância
    if (item.weapon_range === 'Melee') {
        add(['melee-weapon', 'melee-weapons', 'melee weapon', 'simple melee weapon', 'martial melee weapon', 'any melee weapon'], item);
    }
    if (item.weapon_range === 'Ranged') {
        add(['ranged-weapon', 'ranged-weapons', 'ranged weapon', 'simple ranged weapon', 'martial ranged weapon', 'any ranged weapon'], item);
    }

    // Itens gerais
    if (item.equipment_category?.index === 'adventuring-gear') {
        add(['gear', 'adventuring gear'], item);
    }
     // Instrumentos Musicais
    if (item.equipment_category?.index === 'musical-instrument') {
        add(['musical-instruments', 'musical instrument', 'any other musical instrument'], item);
    }
  }

  /* --- Agrupamentos compostos --- */
  const simpleWeapons = equipmentList.filter((i) => i.weapon_category === 'Simple');
  const martialWeapons = equipmentList.filter((i) => i.weapon_category === 'Martial');

  add(['simple-weapons', 'simple-weapon', 'any-simple-weapon'], ...simpleWeapons);
  add(['martial-weapons', 'martial-weapon', 'any-martial-weapon'], ...martialWeapons);

  // Fallback explícito para garantir que a categoria principal exista
  if (!cache['holy-symbols']) {
      cache['holy-symbols'] = equipmentList.filter(i =>
          i.index.includes('holy-symbol') ||
          i.equipment_category?.index === 'holy-symbols' ||
          (i as any).gear_category?.index === 'holy-symbols'
      );
  }
  
  // 🔹 Cria aliases explícitos
  for (const [base, aliases] of Object.entries(ALIASES)) {
    const baseKey = normalizeKey(base);
    if (!cache[baseKey]) continue;
    for (const alias of aliases) {
      const nk = normalizeKey(alias);
      if (!cache[nk] || cache[nk].length === 0) {
        cache[nk] = cache[baseKey];
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
