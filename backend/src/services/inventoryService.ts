// backend/src/services/inventoryService.ts
import { getUnifiedDetails } from './unifiedDataService.js';

const COIN_TYPES = ['pp', 'gp', 'ep', 'sp', 'cp'] as const;
type CoinType = typeof COIN_TYPES[number];
const COIN_WEIGHT = 0.02; // 50 moedas = 1 lb

interface InventoryLike {
    id?: string | number;
    index?: string;
    name?: string;
    quantity?: number;
    itemData?: Record<string, any>;
    weight?: number;
    equipped?: boolean;
    [key: string]: any;
}

export interface InventoryMetrics {
    currency: Record<CoinType, number>;
    totalWeight: number;
    totalCoinCount: number;
}

export interface HydratedInventoryResult {
    items: InventoryLike[];
    metrics: InventoryMetrics;
}

const isCoinIndex = (index?: string): index is CoinType => {
    if (!index) return false;
    return (COIN_TYPES as readonly string[]).includes(index);
};

const normaliseQuantity = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
    return 1;
};

const ensureCurrencyShape = (currency?: Record<string, number>): Record<CoinType, number> => {
    const result: Record<CoinType, number> = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
    if (!currency) return result;
    for (const coin of COIN_TYPES) {
        const value = currency[coin];
        result[coin] = typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
    }
    return result;
};

const mergeCurrency = (...sources: Record<CoinType, number>[]): Record<CoinType, number> => {
    const merged: Record<CoinType, number> = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
    for (const source of sources) {
        for (const coin of COIN_TYPES) {
            merged[coin] += source[coin] ?? 0;
        }
    }
    return merged;
};

export const hydrateInventoryItems = async (
    items: InventoryLike[],
    userId: number
): Promise<HydratedInventoryResult> => {
    if (!Array.isArray(items)) {
        return {
            items: [],
            metrics: {
                currency: ensureCurrencyShape(),
                totalWeight: 0,
                totalCoinCount: 0,
            },
        };
    }

    const hydratedItems: InventoryLike[] = [];
    const currencyFromCoins: Record<CoinType, number> = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
    let baseWeight = 0;
    let totalCoinCount = 0;

    for (const item of items) {
        if (!item) continue;
        const quantity = normaliseQuantity(item.quantity ?? 1);
        const index = item.index || item.itemData?.index;

        if (isCoinIndex(index)) {
            currencyFromCoins[index] += quantity;
            totalCoinCount += quantity;
            hydratedItems.push({
                ...item,
                index,
                quantity,
                name: item.name || index.toUpperCase(),
                equipped: false,
            });
            continue;
        }

        let enrichedItem: InventoryLike = { ...item, quantity };

        const hasClassification =
            enrichedItem.weapon_category ||
            enrichedItem.armor_category ||
            enrichedItem.equipment_category;

        if (!hasClassification && index) {
            try {
                const details = await getUnifiedDetails('equipment', index, userId);
                if (details) {
                    enrichedItem = {
                        ...details,
                        ...enrichedItem,
                        itemData: { ...details, ...(enrichedItem.itemData || {}) },
                    };
                    if (details.weight && !enrichedItem.weight) {
                        enrichedItem.weight = details.weight;
                    }
                }
            } catch (error) {
                console.warn(`[inventoryService] Falha ao buscar detalhes de ${index}:`, error);
            }
        } else if (enrichedItem.itemData && !hasClassification) {
            enrichedItem = {
                ...enrichedItem.itemData,
                ...enrichedItem,
            };
        }

        const weight = typeof enrichedItem.weight === 'number' ? enrichedItem.weight : 0;
        baseWeight += weight * quantity;
        if (typeof enrichedItem.equipped !== 'boolean') {
            enrichedItem.equipped = Boolean(item.equipped);
        }

        hydratedItems.push(enrichedItem);
    }

    const totalWeight = baseWeight + totalCoinCount * COIN_WEIGHT;

    return {
        items: hydratedItems,
        metrics: {
            currency: currencyFromCoins,
            totalWeight,
            totalCoinCount,
        },
    };
};

export const reconcileCurrency = (
    existingCurrency: Record<string, number> | undefined,
    derivedFromCoins: Record<CoinType, number>
): Record<CoinType, number> => {
    const base = ensureCurrencyShape(existingCurrency);
    return mergeCurrency(base, derivedFromCoins);
};
