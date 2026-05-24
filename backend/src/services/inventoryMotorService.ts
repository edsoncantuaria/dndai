import createError from 'http-errors';
import { AppDataSource } from '../database/data-source.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import {
    addOrIncrementCharacterItem,
    applyCurrencyDelta,
    consumeCharacterItem,
    getAuthoritativeInventoryState,
    setCharacterItemEquipped,
    type AuthoritativeInventoryState,
} from './inventoryService.js';

const COIN_KEYS = ['pp', 'gp', 'ep', 'sp', 'cp'] as const;

export async function persistPendingLootOffer(sessionId: number, lootOffer: Record<string, unknown> | null) {
    const repo = AppDataSource.getRepository(SessaoIA);
    await repo.update({ id: sessionId }, { pendingLootOffer: lootOffer });
}

export async function getPendingLootOffer(sessionId: number): Promise<Record<string, unknown> | null> {
    const repo = AppDataSource.getRepository(SessaoIA);
    const sessao = await repo.findOne({ where: { id: sessionId }, select: ['id', 'pendingLootOffer'] });
    return (sessao?.pendingLootOffer as Record<string, unknown>) ?? null;
}

async function resolveSessionCharacter(sessionId: number, userId: number) {
    const repo = AppDataSource.getRepository(SessaoIA);
    const sessao = await repo.findOne({
        where: { id: sessionId, userId },
        relations: ['character', 'character.attributes'],
    });
    if (!sessao?.character) {
        throw createError(404, 'Sessão ou personagem não encontrado.');
    }
    return sessao;
}

export async function applyLootOfferToCharacter(
    characterId: number,
    lootOffer: Record<string, unknown>,
): Promise<void> {
    const items = Array.isArray(lootOffer.items) ? lootOffer.items : [];
    for (const raw of items) {
        if (!raw || typeof raw !== 'object') continue;
        const item = raw as Record<string, unknown>;
        const quantity = Math.max(1, Number(item.quantity ?? 1));
        await addOrIncrementCharacterItem({
            characterId,
            itemId: Number.isFinite(Number(item.id)) ? Number(item.id) : undefined,
            itemIndex: typeof item.index === 'string' ? item.index : undefined,
            quantity,
            name: typeof item.name === 'string' ? item.name : undefined,
            itemData: item,
        });
    }

    const currency = lootOffer.currency;
    if (currency && typeof currency === 'object') {
        const delta: Partial<Record<(typeof COIN_KEYS)[number], number>> = {};
        for (const coin of COIN_KEYS) {
            const value = Number((currency as Record<string, unknown>)[coin]);
            if (Number.isFinite(value) && value > 0) {
                delta[coin] = value;
            }
        }
        if (Object.keys(delta).length) {
            await applyCurrencyDelta(characterId, delta);
        }
    }
}

export async function claimPendingLoot(
    sessionId: number,
    userId: number,
): Promise<AuthoritativeInventoryState> {
    const sessao = await resolveSessionCharacter(sessionId, userId);
    const pending = await getPendingLootOffer(sessionId);
    if (!pending) {
        throw createError(404, 'Não há loot pendente para coletar.');
    }

    await applyLootOfferToCharacter(sessao.character!.id, pending);
    await persistPendingLootOffer(sessionId, null);

    return getAuthoritativeInventoryState(
        sessao.character!.id,
        sessao.character!.attributes?.strength,
    );
}

export async function equipInventoryItem(
    sessionId: number,
    userId: number,
    itemId: number,
    equipped: boolean,
): Promise<AuthoritativeInventoryState> {
    const sessao = await resolveSessionCharacter(sessionId, userId);
    await setCharacterItemEquipped({
        characterId: sessao.character!.id,
        itemId,
        equipped,
    });
    return getAuthoritativeInventoryState(
        sessao.character!.id,
        sessao.character!.attributes?.strength,
    );
}

export async function dropInventoryItem(
    sessionId: number,
    userId: number,
    itemId: number,
    quantity = 1,
): Promise<AuthoritativeInventoryState> {
    const sessao = await resolveSessionCharacter(sessionId, userId);
    await consumeCharacterItem({
        characterId: sessao.character!.id,
        itemId,
        quantity,
    });
    return getAuthoritativeInventoryState(
        sessao.character!.id,
        sessao.character!.attributes?.strength,
    );
}

export function inventoryStateToCharacterPatch(state: AuthoritativeInventoryState) {
    return {
        inventory: state.inventory,
        currency: state.currency,
        currentWeight: state.currentWeight,
        carryingCapacity: state.carryingCapacity,
        totalCoinCount: state.totalCoinCount,
    };
}
