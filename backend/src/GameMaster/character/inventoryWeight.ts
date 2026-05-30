import { getSrdResource } from '../../services/srdCatalogService.js';
import type { HeroInventoryItem } from '../database/entities/HeroInventoryItem.js';
import type { PenaiCoinPurse } from './heroStats.js';

/** D&D 5e: 50 moedas = 1 lb */
export const COIN_WEIGHT_LB = 0.02;

const srdWeightCache = new Map<string, { unitWeightLb: number; bundleQuantity: number }>();

export type WeightableItem = Pick<HeroInventoryItem, 'itemKey' | 'name' | 'quantity' | 'itemData'>;

function bundleQuantityFromSrd(entry: Record<string, unknown>): number {
    const q = Number(entry.quantity);
    return Number.isFinite(q) && q > 0 ? Math.floor(q) : 1;
}

/** Peso por unidade (1 adaga, 1 flecha, …) em libras. */
export function unitWeightFromSrdEntry(entry: Record<string, unknown>): number {
    const totalWeight = Number(entry.weight);
    if (!Number.isFinite(totalWeight) || totalWeight < 0) return 0;
    const bundle = bundleQuantityFromSrd(entry);
    return totalWeight / bundle;
}

export async function lookupSrdUnitWeight(itemKey: string): Promise<number> {
    const key = itemKey.trim().toLowerCase();
    if (!key) return 0;
    const cached = srdWeightCache.get(key);
    if (cached) return cached.unitWeightLb;

    const row = await getSrdResource('equipment', key);
    if (!row || typeof row !== 'object') {
        srdWeightCache.set(key, { unitWeightLb: 0, bundleQuantity: 1 });
        return 0;
    }
    const bundle = bundleQuantityFromSrd(row as Record<string, unknown>);
    const unitWeightLb = unitWeightFromSrdEntry(row as Record<string, unknown>);
    srdWeightCache.set(key, { unitWeightLb, bundleQuantity: bundle });
    return unitWeightLb;
}

/** Resolve peso unitário a partir de itemData ou SRD. */
export async function resolveItemUnitWeightLb(item: WeightableItem): Promise<number> {
    const data = item.itemData ?? {};
    if (typeof data.unitWeightLb === 'number' && data.unitWeightLb >= 0) {
        return data.unitWeightLb;
    }
    if (typeof data.weight === 'number' && data.weight >= 0) {
        const bundle = Number(data.bundleQuantity ?? data.srdBundleQuantity ?? 1);
        return data.weight / Math.max(1, bundle);
    }
    return lookupSrdUnitWeight(item.itemKey);
}

/** Enriquece itemData com peso unitário SRD (para persistir e evitar lookups repetidos). */
export async function enrichItemDataWithWeight(
    itemKey: string,
    itemData: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
    if (typeof itemData.unitWeightLb === 'number') return itemData;
    const row = await getSrdResource('equipment', itemKey.trim().toLowerCase());
    if (!row || typeof row !== 'object') return itemData;
    const bundle = bundleQuantityFromSrd(row as Record<string, unknown>);
    const unitWeightLb = unitWeightFromSrdEntry(row as Record<string, unknown>);
    return {
        ...itemData,
        unitWeightLb,
        srdBundleQuantity: bundle,
        weight: Number((row as { weight?: number }).weight ?? itemData.weight ?? 0),
    };
}

export function computeCoinWeightLb(coins: PenaiCoinPurse | undefined): number {
    if (!coins) return 0;
    const count = coins.pp + coins.gp + coins.ep + coins.sp + coins.cp;
    return count * COIN_WEIGHT_LB;
}

/** Peso total da mochila: soma (unidade × quantidade) + moedas. */
export async function computeInventoryTotalWeightLb(
    items: WeightableItem[],
    coins?: PenaiCoinPurse,
): Promise<number> {
    let total = computeCoinWeightLb(coins);
    for (const item of items) {
        const qty = Math.max(0, Math.floor(Number(item.quantity) || 0));
        if (qty === 0) continue;
        const unit = await resolveItemUnitWeightLb(item);
        total += unit * qty;
    }
    return Math.round(total * 100) / 100;
}

export function computeCarryingCapacityLb(strength: number): number {
    const score = Number.isFinite(strength) ? strength : 10;
    return Math.max(0, score) * 15;
}

export type InventoryWeightBreakdown = {
    totalLb: number;
    coinLb: number;
    itemsLb: number;
    lines: Array<{
        itemKey: string;
        name: string;
        quantity: number;
        unitWeightLb: number;
        lineWeightLb: number;
    }>;
};

export async function breakdownInventoryWeight(
    items: WeightableItem[],
    coins?: PenaiCoinPurse,
): Promise<InventoryWeightBreakdown> {
    const coinLb = computeCoinWeightLb(coins);
    const lines: InventoryWeightBreakdown['lines'] = [];
    let itemsLb = 0;
    for (const item of items) {
        const qty = Math.max(0, Math.floor(Number(item.quantity) || 0));
        if (qty === 0) continue;
        const unitWeightLb = await resolveItemUnitWeightLb(item);
        const lineWeightLb = Math.round(unitWeightLb * qty * 100) / 100;
        itemsLb += lineWeightLb;
        lines.push({
            itemKey: item.itemKey,
            name: item.name,
            quantity: qty,
            unitWeightLb,
            lineWeightLb,
        });
    }
    itemsLb = Math.round(itemsLb * 100) / 100;
    return {
        totalLb: Math.round((itemsLb + coinLb) * 100) / 100,
        coinLb: Math.round(coinLb * 100) / 100,
        itemsLb,
        lines,
    };
}
