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
