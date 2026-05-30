import type { RuleCheckResult } from './types.js';

export interface EquipItemPayload {
    /** UUID do HeroInventoryItem (PENAI) ou id numérico legado (MySQL) */
    inventoryItemId?: string;
    /** itemKey / index SRD — fallback quando id ausente */
    itemKey?: string;
    /** @deprecated legado MySQL — preferir inventoryItemId */
    itemId?: number;
    equipped: boolean;
}

export interface DropItemPayload {
    itemId: number;
    quantity?: number;
}

export function resolveEquipItemKey(payload: EquipItemPayload): string | null {
    if (payload.inventoryItemId?.trim()) return payload.inventoryItemId.trim();
    if (payload.itemKey?.trim()) return payload.itemKey.trim();
    if (payload.itemId != null && Number.isFinite(payload.itemId) && payload.itemId > 0) {
        return String(payload.itemId);
    }
    return null;
}

export function resolveEquipItemNumericId(payload: EquipItemPayload): number | null {
    if (payload.itemId != null && Number.isFinite(payload.itemId) && payload.itemId > 0) {
        return payload.itemId;
    }
    const asNum = Number(payload.inventoryItemId);
    if (Number.isFinite(asNum) && asNum > 0) return asNum;
    return null;
}

export function validateEquipItemIntent(payload: EquipItemPayload): RuleCheckResult {
    const key = resolveEquipItemKey(payload);
    if (!key) {
        return { status: 'rejected', reason: 'Identificador de item inválido.' };
    }
    return {
        status: 'accepted',
        reason: payload.equipped ? 'Equipar item autorizado.' : 'Desequipar item autorizado.',
        authoritativeSignature: `equip:${key}:${payload.equipped}`,
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
