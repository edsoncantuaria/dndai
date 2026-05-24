import createError from 'http-errors';
import { AppDataSource } from '../database/data-source.js';
import { Character } from '../entities/Character.js';
import { SessaoIA } from '../entities/SessaoIA.js';
import type { ShopState } from '../schemas/gameSchemas.js';
import type { OpenShopPayload, BuyItemPayload, SellItemPayload } from '../rules/shopMotor.js';
import {
    addOrIncrementCharacterItem,
    applyCurrencyDelta,
    consumeCharacterItem,
    getAuthoritativeInventoryState,
} from './inventoryService.js';
import { inventoryStateToCharacterPatch } from './inventoryMotorService.js';

const MOTOR_SHOP_WORLD_KEY = 'motorShopState';

export function assertShopAllowedDuringCombat(combatActive: boolean): void {
    if (combatActive) {
        throw createError(409, 'Loja indisponível durante combate ativo.');
    }
}

export async function getMotorShopSnapshot(characterId: number): Promise<ShopState | null> {
    const repo = AppDataSource.getRepository(Character);
    const character = await repo.findOne({
        where: { id: characterId },
        select: ['id', 'worldState'],
    });
    if (!character?.worldState || typeof character.worldState !== 'object') return null;
    const shop = (character.worldState as Record<string, unknown>)[MOTOR_SHOP_WORLD_KEY];
    if (!shop || typeof shop !== 'object') return null;
    const state = shop as ShopState;
    if (!state.isOpen) return null;
    return state;
}

export async function persistMotorShopSnapshot(
    characterId: number,
    shop: ShopState | null,
): Promise<void> {
    const repo = AppDataSource.getRepository(Character);
    const character = await repo.findOne({
        where: { id: characterId },
        select: ['id', 'worldState'],
    });
    if (!character) return;

    const worldState =
        character.worldState && typeof character.worldState === 'object'
            ? { ...(character.worldState as Record<string, unknown>) }
            : {};

    if (!shop || !shop.isOpen) {
        delete worldState[MOTOR_SHOP_WORLD_KEY];
    } else {
        worldState[MOTOR_SHOP_WORLD_KEY] = shop;
    }

    await repo.update({ id: characterId }, { worldState });
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

export async function openMotorShop(
    sessionId: number,
    userId: number,
    payload: OpenShopPayload,
): Promise<ShopState> {
    const sessao = await resolveSessionCharacter(sessionId, userId);
    const shop: ShopState = {
        isOpen: true,
        isHaggling: false,
        name: payload.name ?? payload.merchantName ?? 'Mercador',
        merchant: payload.merchantName ? { name: payload.merchantName } : undefined,
        inventory: (payload.inventory ?? []) as ShopState['inventory'],
        sellPrices: {},
    };
    await persistMotorShopSnapshot(sessao.character!.id, shop);
    return shop;
}

export async function buyFromMotorShop(
    sessionId: number,
    userId: number,
    payload: BuyItemPayload,
): Promise<{ shopState: ShopState; patch: ReturnType<typeof inventoryStateToCharacterPatch> }> {
    const sessao = await resolveSessionCharacter(sessionId, userId);
    const shop = await getMotorShopSnapshot(sessao.character!.id);
    if (!shop?.isOpen) {
        throw createError(409, 'Nenhuma loja aberta neste momento.');
    }

    const itemKey = String(payload.itemId);
    const catalogItem = (shop.inventory ?? []).find(
        entry => String((entry as { id?: unknown }).id) === itemKey,
    );
    if (!catalogItem) {
        throw createError(404, 'Item não encontrado no catálogo da loja.');
    }

    const quantity = Math.max(1, Math.floor(Number(payload.quantity) || 1));
    const costBlock = (catalogItem as { cost?: { quantity?: number; unit?: string }; price?: number }).cost;
    const unitPrice = Number(
        payload.priceGp ??
            costBlock?.quantity ??
            (catalogItem as { price?: number }).price ??
            0,
    );
    const totalCost = unitPrice * quantity;

    const auth = await getAuthoritativeInventoryState(
        sessao.character!.id,
        sessao.character!.attributes?.strength,
    );
    const currentGp = Number(auth.currency?.gp ?? 0);
    if (totalCost > currentGp) {
        throw createError(400, `Ouro insuficiente (precisa ${totalCost} gp, tem ${currentGp} gp).`);
    }

    if (totalCost > 0) {
        await applyCurrencyDelta(sessao.character!.id, { gp: -totalCost });
    }

    await addOrIncrementCharacterItem({
        characterId: sessao.character!.id,
        itemId: Number.isFinite(Number(payload.itemId)) ? Number(payload.itemId) : undefined,
        itemIndex: typeof (catalogItem as { index?: string }).index === 'string'
            ? (catalogItem as { index: string }).index
            : undefined,
        quantity,
        name: typeof (catalogItem as { name?: string }).name === 'string'
            ? (catalogItem as { name: string }).name
            : undefined,
        itemData: catalogItem as Record<string, unknown>,
    });

    const patch = inventoryStateToCharacterPatch(
        await getAuthoritativeInventoryState(
            sessao.character!.id,
            sessao.character!.attributes?.strength,
        ),
    );

    return { shopState: shop, patch };
}

export async function closeMotorShop(sessionId: number, userId: number): Promise<void> {
    const sessao = await resolveSessionCharacter(sessionId, userId);
    await persistMotorShopSnapshot(sessao.character!.id, null);
}

export async function sellToMotorShop(
    sessionId: number,
    userId: number,
    payload: SellItemPayload,
): Promise<{ shopState: ShopState | null; patch: ReturnType<typeof inventoryStateToCharacterPatch> }> {
    const sessao = await resolveSessionCharacter(sessionId, userId);
    const shop = await getMotorShopSnapshot(sessao.character!.id);

    const quantity = Math.max(1, Math.floor(Number(payload.quantity) || 1));
    let sellGp = Number(payload.priceGp);
    if (!Number.isFinite(sellGp) || sellGp < 0) {
        const fromShop = shop?.sellPrices?.[String(payload.itemId)];
        sellGp = Number(fromShop) || 0;
    }
    if (sellGp <= 0) {
        throw createError(400, 'Preço de venda inválido ou não definido.');
    }

    const totalGp = sellGp * quantity;
    await consumeCharacterItem({
        characterId: sessao.character!.id,
        itemId: payload.itemId,
        quantity,
    });
    await applyCurrencyDelta(sessao.character!.id, { gp: totalGp });

    const patch = inventoryStateToCharacterPatch(
        await getAuthoritativeInventoryState(
            sessao.character!.id,
            sessao.character!.attributes?.strength,
        ),
    );

    return { shopState: shop, patch };
}

/** Catálogo padrão para testes / mercador genérico. */
export function buildDefaultShopCatalog(): OpenShopPayload {
    return {
        name: 'Mercador itinerante',
        merchantName: 'Mercador',
        inventory: [
            {
                id: 'shop-potion',
                index: 'potion-of-healing',
                name: 'Poção de Cura',
                cost: { quantity: 50, unit: 'gp' },
                quantity: 10,
            },
            {
                id: 'shop-rations',
                index: 'rations',
                name: 'Rações (1 dia)',
                cost: { quantity: 5, unit: 'sp' },
                quantity: 20,
            },
        ],
    };
}

/** Anexa loja persistida na resposta (fora de combate). */
export async function attachMotorShopToResponse(
    response: { shopState?: ShopState | null; combatState?: { isActive?: boolean } | null },
    characterId: number,
): Promise<void> {
    if (response.combatState?.isActive) {
        delete response.shopState;
        return;
    }
    const snapshot = await getMotorShopSnapshot(characterId);
    if (snapshot) {
        response.shopState = snapshot;
    } else {
        delete response.shopState;
    }
}
