import { AppDataSource } from '../database/data-source.js';
import { CharacterItem } from '../entities/CharacterItem.js';
import { recordActionLog } from './actionLogService.js';
import type { EntityManager } from 'typeorm';

interface LogContext {
    sessionId: number;
    actionId?: string;
    actionType?: string;
    stateVersion?: number;
    metadata?: Record<string, any>;
}

export interface ConsumeItemParams {
    characterId: number;
    itemId?: number;
    itemIndex?: string;
    quantity: number;
    removeWhenZero?: boolean;
    logContext?: LogContext;
}

const COIN_KEYS = ['pp', 'gp', 'ep', 'sp', 'cp'] as const;

const clamp = (value: number, min: number) => (value < min ? min : value);

export interface AddItemParams {
    characterId: number;
    itemId?: number;
    itemIndex?: string;
    quantity: number;
    name?: string;
    itemData?: Record<string, unknown>;
    equipped?: boolean;
}

export type CoinKey = (typeof COIN_KEYS)[number];

export interface AuthoritativeInventoryState {
    inventory: Awaited<ReturnType<typeof hydrateInventoryItems>>['items'];
    currency: Record<CoinKey, number>;
    currentWeight: number;
    carryingCapacity: number;
    totalCoinCount: number;
}

async function findItem(params: { characterId: number; itemId?: number; itemIndex?: string }): Promise<CharacterItem | null> {
    const repo = AppDataSource.getRepository(CharacterItem);
    if (params.itemId) {
        return repo.findOne({ where: { id: params.itemId, characterId: params.characterId } });
    }

    if (params.itemIndex) {
        const items = await repo.find({ where: { characterId: params.characterId } });
        return items.find(item => item.itemData?.index === params.itemIndex) ?? null;
    }

    return null;
}

export async function consumeCharacterItem(params: ConsumeItemParams): Promise<CharacterItem | null> {
    if (params.quantity <= 0) {
        throw new Error('Quantidade a consumir deve ser positiva.');
    }

    const repo = AppDataSource.getRepository(CharacterItem);
    const item = await findItem({ characterId: params.characterId, itemId: params.itemId, itemIndex: params.itemIndex });

    if (!item) {
        throw new Error('Item não encontrado para o personagem informado.');
    }

    const originalQuantity = item.quantity;
    const newQuantity = clamp(item.quantity - params.quantity, 0);
    const delta = newQuantity - originalQuantity;

    if (newQuantity === 0 && (params.removeWhenZero ?? true)) {
        await repo.remove(item);
    } else {
        item.quantity = newQuantity;
        await repo.save(item);
    }

    if (params.logContext) {
        const { logContext } = params;
        await recordActionLog({
            sessionId: logContext.sessionId,
            actionId: logContext.actionId,
            actionType: logContext.actionType ?? 'inventory.consume',
            stateVersion: logContext.stateVersion,
            characterId: params.characterId,
            delta: {
                inventory: [
                    {
                        itemId: item.id,
                        itemIndex: item.itemData?.index,
                        quantityDelta: delta,
                    },
                ],
            },
            metadata: {
                ...(logContext.metadata ?? {}),
                removed: newQuantity === 0,
            },
        });
    }

    return newQuantity === 0 ? null : item;
}

/** Adiciona ou incrementa quantidade de um item (delta positivo — Fase 5.2). */
export async function addOrIncrementCharacterItem(params: AddItemParams): Promise<CharacterItem> {
    if (params.quantity <= 0) {
        throw new Error('Quantidade a adicionar deve ser positiva.');
    }

    const repo = AppDataSource.getRepository(CharacterItem);
    const existing = await findItem({
        characterId: params.characterId,
        itemId: params.itemId,
        itemIndex: params.itemIndex,
    });

    if (existing) {
        existing.quantity = (existing.quantity ?? 0) + params.quantity;
        if (params.itemData) {
            existing.itemData = { ...(existing.itemData || {}), ...params.itemData };
        }
        if (params.name) existing.name = params.name;
        return repo.save(existing);
    }

    const itemName = params.name ?? params.itemData?.name as string ?? params.itemIndex ?? 'Item';
    const itemData = {
        ...(params.itemData ?? {}),
        index: params.itemIndex ?? params.itemData?.index,
        name: itemName,
        quantity: params.quantity,
    };
    const created = repo.create({
        characterId: params.characterId,
        name: itemName,
        quantity: params.quantity,
        equipped: params.equipped ?? false,
        itemData,
    });
    return repo.save(created);
}

export async function setCharacterItemEquipped(params: {
    characterId: number;
    itemId: number;
    equipped: boolean;
}): Promise<CharacterItem> {
    const repo = AppDataSource.getRepository(CharacterItem);
    const item = await repo.findOne({ where: { id: params.itemId, characterId: params.characterId } });
    if (!item) {
        throw new Error('Item não encontrado para equipar/desequipar.');
    }
    item.equipped = params.equipped;
    if (item.itemData && typeof item.itemData === 'object') {
        item.itemData = { ...item.itemData, equipped: params.equipped };
    }
    return repo.save(item);
}

export async function applyCurrencyDelta(
    characterId: number,
    delta: Partial<Record<CoinKey, number>>,
): Promise<Record<CoinKey, number>> {
    const { Character } = await import('../entities/Character.js');
    const repo = AppDataSource.getRepository(Character);
    const character = await repo.findOne({ where: { id: characterId } });
    if (!character) {
        throw new Error('Personagem não encontrado para aplicar delta de moedas.');
    }

    const current = reconcileCurrency(null, character.coins as Record<string, unknown>);
    for (const coin of COIN_KEYS) {
        const change = Number(delta[coin]);
        if (Number.isFinite(change) && change !== 0) {
            current[coin] = Math.max(0, (current[coin] ?? 0) + change);
        }
    }

    character.coins = current;
    await repo.save(character);
    return current;
}

export async function getCharacterCurrency(characterId: number): Promise<Record<CoinKey, number>> {
    const { Character } = await import('../entities/Character.js');
    const repo = AppDataSource.getRepository(Character);
    const character = await repo.findOne({ where: { id: characterId }, select: ['id', 'coins'] });
    return reconcileCurrency(null, character?.coins as Record<string, unknown>);
}

export function computeCarryingCapacity(strength: number | null | undefined): number {
    const score = Number.isFinite(Number(strength)) ? Number(strength) : 10;
    return score * 15;
}

/** Snapshot autoritativo de inventário + moedas + carga (Fase 5.4). */
export async function getAuthoritativeInventoryState(
    characterId: number,
    strength?: number | null,
): Promise<AuthoritativeInventoryState> {
    const snapshot = await getInventorySnapshotFromDb(characterId);
    const hydrated = await hydrateInventoryItems(snapshot);
    const currency = await getCharacterCurrency(characterId);
    const mergedCurrency = reconcileCurrency(currency, hydrated.metrics.currency);
    const carryingCapacity = computeCarryingCapacity(strength);
    return {
        inventory: hydrated.items,
        currency: mergedCurrency,
        currentWeight: hydrated.metrics.totalWeight,
        carryingCapacity,
        totalCoinCount: Object.values(mergedCurrency).reduce((sum, v) => sum + v, 0),
    };
}

export async function enrichUpdatedCharacterInventory(
    characterId: number,
    strength?: number | null,
): Promise<AuthoritativeInventoryState> {
    return getAuthoritativeInventoryState(characterId, strength);
}

export async function getInventorySnapshotFromDb(characterId: number, manager?: EntityManager) {
    const repo = (manager ?? AppDataSource.manager).getRepository(CharacterItem);
    const rows = await repo.find({ where: { characterId } });
    return rows.map(row => ({
        id: row.id,
        index: row.itemData?.index ?? null,
        name: row.name ?? row.itemData?.name ?? `Item ${row.id}`,
        quantity: row.quantity ?? 1,
        equipped: row.equipped ?? false,
        weight: (row.itemData as any)?.weight ?? 0,
        itemData: row.itemData ?? null,
    }));
}

interface HydrationOptions {
    allowHomebrew?: boolean;
}

export const reconcileCurrency = (
    primary?: Record<string, unknown>,
    fallback?: Record<string, unknown>
) => {
    const result: Record<(typeof COIN_KEYS)[number], number> = {
        pp: 0,
        gp: 0,
        ep: 0,
        sp: 0,
        cp: 0,
    };

    const apply = (source?: Record<string, unknown>) => {
        if (!source) return;
        for (const coin of COIN_KEYS) {
            const value = Number((source as any)[coin]);
            if (Number.isFinite(value) && value >= 0) {
                result[coin] = value;
            }
        }
    };

    apply(fallback);
    apply(primary);

    return result;
};

export async function hydrateInventoryItems(
    items: any[],
    _userId: number,
    baseline?: any[],
    _options?: HydrationOptions
) {
    const baselineMap = new Map<string, any>();
    (baseline || []).forEach(entry => {
        if (!entry) return;
        const key = String(entry.id ?? entry.index ?? entry.name ?? Math.random());
        baselineMap.set(key, entry);
    });

    const sanitized: any[] = [];
    let totalWeight = 0;
    const currencyAccumulator: Record<string, number> = {
        pp: 0,
        gp: 0,
        ep: 0,
        sp: 0,
        cp: 0,
    };

    items.forEach((raw, index) => {
        if (!raw) return;
        const lookupKey = String(raw.id ?? raw.index ?? raw.name ?? index);
        const fallback = baselineMap.get(lookupKey);
        const quantity = Number.isFinite(Number(raw.quantity))
            ? Number(raw.quantity)
            : Number(fallback?.quantity ?? 1);
        const weight =
            Number(raw.weight ?? raw.itemData?.weight ?? fallback?.weight ?? fallback?.itemData?.weight ?? 0) || 0;

        const normalized = {
            id: raw.id ?? fallback?.id ?? lookupKey,
            index: raw.index ?? fallback?.index ?? null,
            name: raw.name ?? fallback?.name ?? `Item ${index + 1}`,
            quantity,
            equipped: Boolean(raw.equipped ?? fallback?.equipped),
            weight,
            metadata: raw.metadata ?? fallback?.metadata ?? null,
            itemData: raw.itemData ?? fallback?.itemData ?? null,
        };

        totalWeight += weight * quantity;

        if (raw.currency && typeof raw.currency === 'object') {
            for (const coin of COIN_KEYS) {
                const value = Number(raw.currency[coin]);
                if (Number.isFinite(value) && value > 0) {
                    currencyAccumulator[coin] += value;
                }
            }
        }

        sanitized.push(normalized);
    });

    const totalCoinCount = Object.values(currencyAccumulator).reduce((sum, value) => sum + value, 0);

    return {
        items: sanitized,
        metrics: {
            totalWeight,
            totalCoinCount,
            currency: currencyAccumulator,
        },
    };
}
