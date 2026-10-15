// backend/src/rules/armors.ts
import { listSrdResources, getSrdResource } from '../services/srdCatalogService.js';
import { asSrdRecord, type SrdRecord } from './srdRecord.js';

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
    const armor = asSrdRecord(await getSrdResource('equipment', index));
    if (!armor?.armor_category) return null;
    return normalizeArmor(armor);
}

export async function listNormalizedArmors(): Promise<NormalizedArmor[]> {
    const equipment = await listSrdResources('equipment');
    return equipment
        .filter(entry => {
            const e = asSrdRecord(entry);
            return e?.armor_category && ARMOR_TYPES.has(String(e.armor_category).toLowerCase());
        })
        .map(entry => normalizeArmor(asSrdRecord(entry)!));
}

function normalizeArmor(entry: SrdRecord): NormalizedArmor {
    const e = entry as SrdRecord & Record<string, unknown>;
    const armorClass = e.armor_class as { base?: number; dex_bonus?: boolean; max_bonus?: number } | undefined;
    const cost = e.cost as { quantity?: number; unit?: string } | undefined;
    return {
        index: String(e.index ?? ''),
        name: String(e.name ?? ''),
        category: String(e.armor_category ?? ''),
        baseArmorClass: armorClass?.base ?? 10,
        dexBonus: Boolean(armorClass?.dex_bonus),
        maxDexBonus: armorClass?.max_bonus ?? null,
        strengthRequirement: (e.str_minimum as number | undefined) ?? null,
        stealthDisadvantage: Boolean(e.stealth_disadvantage),
        weight: typeof e.weight === 'number' ? e.weight : undefined,
        cost: cost?.quantity != null && cost.unit
            ? { amount: cost.quantity, currency: cost.unit }
            : undefined,
    };
}
