// backend/src/rules/armors.ts
import { listSrdResources, getSrdResource } from '../services/srdCatalogService.js';

export interface NormalizedArmor {
    index: string;
    name: string;
    category: string;
    baseArmorClass: number;
    dexBonus: boolean;
    maxDexBonus?: number | null;
    strengthRequirement?: number | null;
    stealthDisadvantage?: boolean;
    weight?: number;
    cost?: { amount: number; currency: string };
}

const ARMOR_TYPES = new Set(['light', 'medium', 'heavy', 'shield']);

export async function getNormalizedArmor(index: string): Promise<NormalizedArmor | null> {
    const armor = await getSrdResource('equipment', index);
    if (!armor || !armor.armor_category) return null;
    return normalizeArmor(armor);
}

export async function listNormalizedArmors(): Promise<NormalizedArmor[]> {
    const equipment = await listSrdResources('equipment');
    return equipment
        .filter(entry => entry.armor_category && ARMOR_TYPES.has(entry.armor_category.toLowerCase()))
        .map(normalizeArmor);
}

function normalizeArmor(entry: any): NormalizedArmor {
    return {
        index: entry.index,
        name: entry.name,
        category: entry.armor_category,
        baseArmorClass: entry.armor_class?.base ?? 10,
        dexBonus: Boolean(entry.armor_class?.dex_bonus),
        maxDexBonus: entry.armor_class?.max_bonus ?? null,
        strengthRequirement: entry.str_minimum ?? null,
        stealthDisadvantage: Boolean(entry.stealth_disadvantage),
        weight: entry.weight ?? null,
        cost: entry.cost
            ? { amount: entry.cost.quantity, currency: entry.cost.unit }
            : undefined,
    };
}
