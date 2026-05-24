import type { RuleCheckResult } from './types.js';

export interface EquipItemPayload {
    itemId: number;
    equipped: boolean;
}

export interface DropItemPayload {
    itemId: number;
    quantity?: number;
}

export function validateEquipItemIntent(payload: EquipItemPayload): RuleCheckResult {
    if (!Number.isFinite(payload.itemId) || payload.itemId <= 0) {
        return { status: 'rejected', reason: 'itemId inválido.' };
    }
    return {
        status: 'accepted',
        reason: payload.equipped ? 'Equipar item autorizado.' : 'Desequipar item autorizado.',
        authoritativeSignature: `equip:${payload.itemId}:${payload.equipped}`,
        data: payload,
    };
}

export function validateDropItemIntent(payload: DropItemPayload): RuleCheckResult {
    if (!Number.isFinite(payload.itemId) || payload.itemId <= 0) {
        return { status: 'rejected', reason: 'itemId inválido.' };
    }
    const quantity = payload.quantity ?? 1;
    if (quantity <= 0) {
        return { status: 'rejected', reason: 'Quantidade deve ser positiva.' };
    }
    return {
        status: 'accepted',
        stateDelta: {
            character: {
                inventory: [{ itemId: payload.itemId, quantityDelta: -Math.abs(quantity) }],
            },
        },
        authoritativeSignature: `drop:${payload.itemId}:${quantity}`,
        data: { ...payload, quantity },
    };
}

export function validateClaimLootIntent(): RuleCheckResult {
    return {
        status: 'accepted',
        reason: 'Coleta de loot pendente autorizada.',
        authoritativeSignature: 'claim-loot',
    };
}
