// backend/src/services/inventoryService.ts
import { AppDataSource } from '../database/data-source.js';
import { CharacterItem } from '../entities/CharacterItem.js';
import type { EntityManager } from 'typeorm';
import { getUnifiedDetails } from './unifiedDataService.js';

const COIN_TYPES = ['pp', 'gp', 'ep', 'sp', 'cp'] as const;
type CoinType = typeof COIN_TYPES[number];
const COIN_WEIGHT = 0.02; // 50 moedas = 1 lb

export interface InventoryLike {
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

const getItemsRepository = (manager?: EntityManager) => {
    if (manager) {
        return manager.getRepository(CharacterItem);
    }
    return AppDataSource.getRepository(CharacterItem);
};

const normaliseDbItem = (item: CharacterItem): InventoryLike => {
    const baseData = item.itemData && typeof item.itemData === 'object'
        ? item.itemData
        : {};

    const indexFromUrl = typeof baseData.url === 'string'
        ? baseData.url.split('/').filter(Boolean).pop()
        : undefined;

    return {
        ...baseData,
        id: item.id.toString(),
        index: baseData.index || indexFromUrl || baseData.name || item.name,
        name: baseData.name || item.name,
        quantity: item.quantity ?? baseData.quantity ?? 1,
        equipped: typeof item.equipped === 'boolean' ? item.equipped : Boolean(baseData.equipped),
    };
};

export const getInventorySnapshotFromDb = async (
    characterId: number,
    manager?: EntityManager
): Promise<InventoryLike[]> => {
    const repo = getItemsRepository(manager);
    const storedItems = await repo.find({
        where: { characterId },
        order: { id: 'ASC' },
    });
    return storedItems.map(normaliseDbItem);
};

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

const buildItemKey = (item?: InventoryLike): string | null => {
    if (!item) return null;
    const raw = item.index || item.id || item.name;
    if (!raw) return null;
    return String(raw).toLowerCase();
};

const mergeWithFallback = (item: InventoryLike, fallback?: InventoryLike): InventoryLike => {
    if (!fallback) return { ...item };
    const merged = { ...fallback, ...item };
    if (!merged.index && fallback.index) merged.index = fallback.index;
    if (!merged.name && fallback.name) merged.name = fallback.name;
    if (item.quantity === undefined && fallback.quantity !== undefined) {
        merged.quantity = fallback.quantity;
    }
    if (item.equipped === undefined && fallback.equipped !== undefined) {
        merged.equipped = fallback.equipped;
    }
    if (!merged.itemData && fallback.itemData) {
        merged.itemData = fallback.itemData;
    }
    if (!merged.id && fallback.id) {
        merged.id = fallback.id;
    }
    return merged;
};

interface HydrationOptions {
    allowHomebrew?: boolean;
}

export const hydrateInventoryItems = async (
    items: InventoryLike[],
    userId: number,
    fallbackItems?: InventoryLike[],
    options: HydrationOptions = {}
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

    const allowHomebrew = options.allowHomebrew ?? true;

    const fallbackMap = new Map<string, InventoryLike>();
    if (Array.isArray(fallbackItems)) {
        for (const fallback of fallbackItems) {
            const key = buildItemKey(fallback);
            if (key) {
                fallbackMap.set(key, fallback);
            }
        }
    }

    const hydratedItems: InventoryLike[] = [];
    const currencyFromCoins: Record<CoinType, number> = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
    let baseWeight = 0;
    let totalCoinCount = 0;

    for (const item of items) {
        if (!item) continue;
        const key = buildItemKey(item);
        const withFallback = mergeWithFallback(item, key ? fallbackMap.get(key) : undefined);
        const hasFallback = Boolean(key && fallbackMap.get(key));

        const quantity = normaliseQuantity(withFallback.quantity ?? 1);
        const index = withFallback.index || withFallback.itemData?.index;

        if (isCoinIndex(index)) {
            currencyFromCoins[index] += quantity;
            totalCoinCount += quantity;
            hydratedItems.push({
                ...withFallback,
                index,
                quantity,
                name: withFallback.name || index.toUpperCase(),
                equipped: Boolean(withFallback.equipped),
            });
            continue;
        }

        let enrichedItem: InventoryLike = { ...withFallback, quantity };
        let hasUnifiedDetails = false;

        let unifiedDetails: InventoryLike | null = null;
        if (index && !hasFallback) {
            try {
                unifiedDetails = await getUnifiedDetails('equipment', index, userId);
            } catch (error) {
                console.warn(`[inventoryService] Falha ao buscar detalhes de ${index}:`, error);
            }
        }

        if (unifiedDetails) {
            hasUnifiedDetails = true;
            enrichedItem = {
                ...unifiedDetails,
                ...enrichedItem,
                itemData: { ...unifiedDetails, ...(enrichedItem.itemData || {}) },
            };
            if (unifiedDetails.weight && !enrichedItem.weight) {
                enrichedItem.weight = unifiedDetails.weight;
            }
        } else if (enrichedItem.itemData) {
            enrichedItem = {
                ...enrichedItem.itemData,
                ...enrichedItem,
            };
            const classificationExists =
                enrichedItem.weapon_category ||
                enrichedItem.armor_category ||
                enrichedItem.equipment_category;
            hasUnifiedDetails = Boolean(classificationExists);
        }

        if (!allowHomebrew && !hasFallback && !hasUnifiedDetails) {
            const identifier = enrichedItem.index || enrichedItem.name || enrichedItem.id;
            console.warn(`[inventoryService] Ignorando item não reconhecido (homebrew desativado): ${identifier}`);
            continue;
        }

        const weight = typeof enrichedItem.weight === 'number' ? enrichedItem.weight : 0;
        baseWeight += weight * quantity;
        if (typeof enrichedItem.equipped !== 'boolean') {
            enrichedItem.equipped = Boolean(withFallback.equipped);
        }
        if (!enrichedItem.id) {
            const identifier = enrichedItem.index || enrichedItem.name;
            enrichedItem.id = identifier ? String(identifier) : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
