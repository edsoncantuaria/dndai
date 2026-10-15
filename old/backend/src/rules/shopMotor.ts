import type { RuleCheckResult } from './types.js';
import type { CombatState } from '../schemas/gameSchemas.js';

function assertShopAllowedDuringCombat(combatActive: boolean): void {
    if (combatActive) {
        throw new Error('Loja indisponível durante combate.');
    }
}

export type OpenShopPayload = {
    name?: string;
    merchantName?: string;
    inventory?: Array<Record<string, unknown>>;
};

export type BuyItemPayload = {
    itemId: string | number;
    priceGp?: number;
    quantity?: number;
};

export type CloseShopPayload = Record<string, never>;

export function validateOpenShopIntent(
    combatState: CombatState | null | undefined,
    payload: OpenShopPayload,
): RuleCheckResult {
    try {
        assertShopAllowedDuringCombat(Boolean(combatState?.isActive));
    } catch (err) {
        return {
            status: 'rejected',
            reason: err instanceof Error ? err.message : 'Loja indisponível em combate.',
        };
    }
    if (!payload.inventory?.length) {
        return {
            status: 'rejected',
            reason: 'Catálogo da loja vazio ou ausente.',
        };
    }
    return {
        status: 'accepted',
        authoritativeSignature: 'open-shop',
        data: payload as Record<string, unknown>,
    };
}

export function validateBuyItemIntent(payload: BuyItemPayload): RuleCheckResult {
    const itemId = payload.itemId;
    if (itemId === undefined || itemId === null || String(itemId).length === 0) {
        return { status: 'rejected', reason: 'itemId obrigatório para compra.' };
    }
    const price = Number(payload.priceGp);
    if (!Number.isFinite(price) || price < 0) {
        return { status: 'rejected', reason: 'priceGp inválido.' };
    }
    const quantity = Math.max(1, Math.floor(Number(payload.quantity) || 1));
    return {
        status: 'accepted',
        authoritativeSignature: `buy-item:${itemId}`,
        data: { ...payload, quantity, priceGp: price },
    };
}

export function validateCloseShopIntent(): RuleCheckResult {
    return {
        status: 'accepted',
        authoritativeSignature: 'close-shop',
    };
}

export type SellItemPayload = {
    itemId: number;
    priceGp?: number;
    quantity?: number;
};

export function validateSellItemIntent(payload: SellItemPayload): RuleCheckResult {
    if (!Number.isFinite(payload.itemId) || payload.itemId <= 0) {
        return { status: 'rejected', reason: 'itemId inválido para venda.' };
    }
    const price = Number(payload.priceGp);
    if (payload.priceGp !== undefined && (!Number.isFinite(price) || price < 0)) {
        return { status: 'rejected', reason: 'priceGp inválido.' };
    }
    const quantity = Math.max(1, Math.floor(Number(payload.quantity) || 1));
    return {
        status: 'accepted',
        authoritativeSignature: `sell-item:${payload.itemId}`,
        data: { ...payload, quantity },
    };
}
