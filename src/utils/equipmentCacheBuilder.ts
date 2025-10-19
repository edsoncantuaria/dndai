// src/utils/equipmentCacheBuilder.ts
import type { InventoryItem } from '@/types';
import * as DndApiService from '@/services/dndApiService';

/**
 * 🔹 Normaliza uma string em formato de chave
 * Ex: "Holy Symbols" -> "holy-symbols"
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

/**
 * Tenta encontrar a melhor chave correspondente no cache.
 * Suporta variações plurais e aliases (weapon/weapons etc.)
 */
export const findCacheMatch = (key: string, cache: Record<string, any[]>): string | null => {
    if (!key || !cache) return null;
    const nk = normalizeKey(key);
    const keys = Object.keys(cache);
    if (keys.includes(nk)) return nk;

    const variants = [
      nk,
      nk.endsWith('s') ? nk.slice(0, -1) : nk + 's',
      nk.replace(/-weapons$/, '-weapon'),
      nk.replace(/-weapon$/, '-weapons')
    ];

    for (const v of variants) {
        if (keys.includes(v)) return v;
    }

    const partialMatch = keys.find(k => k.includes(nk) || nk.includes(k));
    return partialMatch ?? null;
};


/**
 * 🔹 Cria o cache global de equipamentos categorizados
 */
export async function buildEquipmentCache(): Promise<Record<string, InventoryItem[]>> {
  const equipmentList = await DndApiService.getEquipment();
  if (!Array.isArray(equipmentList)) throw new Error('Lista de equipamentos inválida.');

  const cache: Record<string, InventoryItem[]> = {};

  const add = (keys: string[], items: InventoryItem[]) => {
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

  /** Aliases globais conhecidos (SRD + Homebrew) */
  const ALIASES: Record<string, string[]> = {
    'holy-symbols': ['holy-symbol', 'holy symbols', 'holy symbol', 'símbolos sagrados', 'símbolo sagrado', 'símbolo'],
    'simple-weapons': ['simple-weapon', 'simple weapons', 'simple weapon', 'armas simples'],
    'martial-weapons': ['martial-weapon', 'martial weapons', 'martial weapon', 'armas marciais'],
    'musical-instruments': ['musical-instrument', 'instrumentos musicais', 'any musical instrument'],
    'arcane-foci': ['arcane-focus', 'foco arcano', 'arcane focuses'],
    'druidic-foci': ['druidic-focus', 'foco druídico', 'druidic focuses'],
    shield: ['shields', 'any shield', 'escudo', 'a shield'],
  };

  /** 🔹 Percorre todos os itens e os insere nas categorias adequadas */
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

    if (categories.length) add(categories, [item]);
  }

  /** --- Agrupamentos compostos --- */
  const simpleWeapons = equipmentList.filter(i => i.weapon_category === 'Simple');
  const martialWeapons = equipmentList.filter(i => i.weapon_category === 'Martial');
  const holySymbols = equipmentList.filter(i => i.equipment_category?.index === 'holy-symbols' || ['amulet', 'emblem', 'reliquary'].includes(i.index));
  
  add(['simple-weapons', 'simple weapon', 'any-simple-weapon'], simpleWeapons);
  add(['martial-weapons', 'martial weapon', 'any-martial-weapon'], martialWeapons);
  add(['holy-symbols', 'holy symbol'], holySymbols);


  /** --- Criação de aliases explícitos --- */
  for (const [base, aliases] of Object.entries(ALIASES)) {
    const baseKey = normalizeKey(base);
    if (!cache[baseKey] || cache[baseKey].length === 0) {
        // Se a chave base não existir, mas uma de suas variantes sim, usa ela como base.
        const variantKey = aliases.map(normalizeKey).find(key => cache[key] && cache[key].length > 0);
        const sourceKey = variantKey || baseKey;
        if(cache[sourceKey]) {
            for (const alias of aliases) {
                cache[normalizeKey(alias)] = cache[sourceKey];
            }
        }
    } else {
         for (const alias of aliases) {
            cache[normalizeKey(alias)] = cache[baseKey];
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
  if (cache[nk]?.length) return cache[nk];

  try {
    const category = await DndApiService.getEquipmentCategoryDetails(nk);
    if (category?.equipment) {
        const list = category.equipment as InventoryItem[];
        cache[nk] = list; // Adiciona ao cache para futuras consultas
        return list;
    }
  } catch (err: any) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[EquipmentCache] Fallback falhou: ${nk} (${err?.message})`);
    }
  }

  return [];
}
