// src/utils/parseEquipmentChoiceText.ts
import type { InventoryItem } from "@/types";

/**
 * 🔹 Função que transforma um texto de escolha de equipamento
 * em uma lista de opções semânticas estruturadas.
 *
 * Exemplo:
 * "(a) a martial weapon and a shield or (b) two martial weapons"
 *  ⟶ [
 *       { label: "a martial weapon and a shield", items: ["martial weapon", "shield"] },
 *       { label: "two martial weapons", items: ["martial weapon", "martial weapon"] }
 *     ]
 */
export function parseEquipmentChoiceText(
  text: string,
  equipmentCategoryCache?: Record<string, InventoryItem[]>
) {
  if (!text) return [];

  const normalized = text
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/’/g, "'")
    .trim();

  // Divide opções principais "(a) ... or (b) ..."
  const optionParts = normalized.split(/\sor\s/i).map(part => part.trim());

  const parsed = optionParts.map((optionText) => {
    // remove marcador (a), (b) etc.
    const label = optionText.replace(/^\([a-z]\)\s*/i, "").trim();

    // Quebra por conjunções and / ou vírgulas
    const itemTexts = label
      .split(/\s(?:and|,)\s/i)
      .map(t => t.trim())
      .filter(Boolean);

    const items: { name: string; options?: InventoryItem[] }[] = [];

    for (const raw of itemTexts) {
      const key = normalizeEquipmentKey(raw);
      const cacheKey = findCacheMatch(key, equipmentCategoryCache);

      items.push({
        name: raw,
        options: cacheKey ? equipmentCategoryCache?.[cacheKey] || [] : [],
      });
    }

    return { label, items };
  });

  return parsed;
}

/** Normaliza nomes como "a martial weapon" -> "martial-weapon" */
function normalizeEquipmentKey(str: string) {
  return str
    .toLowerCase()
    .replace(/\b(a|an|any|one|two|three)\b/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Tenta encontrar a melhor chave correspondente no cache.
 * Suporta variações plurais e aliases (weapon/weapons etc.)
 */
function findCacheMatch(
  key: string,
  cache?: Record<string, InventoryItem[]>
): string | null {
  if (!cache) return null;

  const allKeys = Object.keys(cache);
  if (allKeys.includes(key)) return key;

  // Fallbacks plurais e genéricos
  const fallbackKeys = [
    key.replace(/s$/, ""), // remove plural
    key + "s", // adiciona plural
    key.replace(/-weapon$/, "-weapons"),
    key.replace(/-weapons$/, "-weapon"),
    key.replace(/-$/, ""),
  ];

  for (const fk of fallbackKeys) {
    const match = allKeys.find(k => k === fk);
    if (match) return match;
  }

  // Busca aproximada
  const match = allKeys.find(k => k.includes(key) || key.includes(k));
  return match || null;
}
