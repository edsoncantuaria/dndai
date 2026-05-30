import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { CanonicalPoi } from '../database/entities/CanonicalPoi.js';
import { CanonicalRegion } from '../database/entities/CanonicalRegion.js';
import { getPenaiCombatState } from '../combat/engine.js';
import {
    validateOpenShopIntent,
    validateBuyItemIntent,
    validateSellItemIntent,
    validateCloseShopIntent,
} from '../../rules/shopMotor.js';
import type { RuleCheckResult } from '../../rules/types.js';
import { loadHeroSessionStats, saveHeroSessionStats } from '../character/heroStats.js';
import { getSessionHeroEntityId } from '../character/heroStats.js';
import {
    addHeroInventoryItem,
    consumeHeroInventoryItem,
    listHeroInventory,
} from '../character/heroInventory.js';

export async function getMotorShopSnapshotPenai(sessionId: number): Promise<Record<string, unknown> | null> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    return session?.motorShopState ?? null;
}

export async function openShopPenai(
    sessionId: number,
    payload: Record<string, unknown>,
): Promise<RuleCheckResult> {
    const combat = await getPenaiCombatState(sessionId);
    const check = validateOpenShopIntent(
        combat.isActive ? { isActive: true } : { isActive: false },
        payload as { inventory?: Array<Record<string, unknown>> },
    );
    if (check.status !== 'accepted') return check;

    const shopState = {
        name: payload.name ?? 'Loja',
        merchantName: payload.merchantName ?? null,
        inventory: payload.inventory ?? [],
        openedAt: new Date().toISOString(),
    };

    const repo = PenaiDataSource.getRepository(GameSession);
    const session = await repo.findOne({ where: { id: sessionId } });
    if (session) {
        session.motorShopState = shopState;
        await repo.save(session);
    }

    return { ...check, data: { shopState } };
}

export async function buyFromShopPenai(
    sessionId: number,
    payload: Record<string, unknown>,
): Promise<RuleCheckResult> {
    const check = validateBuyItemIntent(payload as { itemId: string | number; priceGp?: number });
    if (check.status !== 'accepted') return check;

    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    const shop = session?.motorShopState as { inventory?: Array<Record<string, unknown>> } | null;
    if (!shop?.inventory?.length) {
        return { status: 'rejected', reason: 'Nenhuma loja aberta.' };
    }

    const itemId = String(payload.itemId);
    const catalogItem = shop.inventory.find(
        (i: Record<string, unknown>) => String(i.id) === itemId,
    );
    if (!catalogItem) {
        return { status: 'rejected', reason: 'Item não encontrado no catálogo.' };
    }

    const priceGp = Number(payload.priceGp ?? (catalogItem as { cost?: { quantity?: number } }).cost?.quantity ?? 0);
    const quantity = Math.max(1, Number(payload.quantity ?? 1));
    const total = priceGp * quantity;

    const heroEntityId = await getSessionHeroEntityId(sessionId);
    if (!heroEntityId) return { status: 'rejected', reason: 'Herói não encontrado.' };

    const stats = await loadHeroSessionStats(sessionId, heroEntityId);
    if (stats.coins.gp < total) {
        return { status: 'rejected', reason: 'Moedas insuficientes (GP).' };
    }

    stats.coins.gp -= total;
    await saveHeroSessionStats(sessionId, heroEntityId, stats);

    const itemKey = typeof catalogItem.index === 'string' ? catalogItem.index : itemId;
    await addHeroInventoryItem({
        sessionId,
        heroEntityId,
        itemKey,
        name: String(catalogItem.name ?? itemKey),
        quantity,
        itemData: catalogItem as Record<string, unknown>,
    });

    return {
        status: 'accepted',
        reason: 'Compra realizada.',
        data: { itemKey, totalGp: total },
    };
}

export async function sellToShopPenai(
    sessionId: number,
    payload: Record<string, unknown>,
): Promise<RuleCheckResult> {
    const check = validateSellItemIntent(payload as { itemId: number; priceGp?: number });
    if (check.status !== 'accepted') return check;

    const heroEntityId = await getSessionHeroEntityId(sessionId);
    if (!heroEntityId) return { status: 'rejected', reason: 'Herói não encontrado.' };

    const itemId = String(payload.itemId);
    const items = await listHeroInventory(sessionId, heroEntityId);
    const row = items.find(i => i.id === itemId || i.itemKey === itemId);
    if (!row) return { status: 'rejected', reason: 'Item não está no inventário.' };

    const priceGp = Number(payload.priceGp ?? 0);
    const quantity = Math.max(1, Number(payload.quantity ?? 1));
    const ok = await consumeHeroInventoryItem({
        sessionId,
        heroEntityId,
        itemId: row.id,
        quantity,
    });
    if (!ok) return { status: 'rejected', reason: 'Quantidade insuficiente.' };

    const stats = await loadHeroSessionStats(sessionId, heroEntityId);
    stats.coins.gp += priceGp * quantity;
    await saveHeroSessionStats(sessionId, heroEntityId, stats);

    return { status: 'accepted', reason: 'Venda realizada.', data: { gp: priceGp * quantity } };
}

export async function closeShopPenai(sessionId: number): Promise<RuleCheckResult> {
    const check = validateCloseShopIntent();
    const repo = PenaiDataSource.getRepository(GameSession);
    const session = await repo.findOne({ where: { id: sessionId } });
    if (session) {
        session.motorShopState = null;
        await repo.save(session);
    }
    return check;
}

/** Catálogo padrão quando há POI shop na região. */
export async function defaultShopCatalogForRegion(
    regionSlug: string | null,
): Promise<Array<Record<string, unknown>>> {
    if (!regionSlug) return starterCatalog();
    const region = await PenaiDataSource.getRepository(CanonicalRegion).findOne({
        where: { slug: regionSlug },
    });
    if (!region) return starterCatalog();
    const pois = await PenaiDataSource.getRepository(CanonicalPoi).find({
        where: { regionId: region.id, poiType: 'shop' },
        take: 1,
    });
    if (!pois.length) return starterCatalog();
    return starterCatalog();
}

function starterCatalog(): Array<Record<string, unknown>> {
    return [
        {
            id: 'healing-potion',
            index: 'healing-potion',
            name: 'Poção de cura',
            cost: { quantity: 50, unit: 'gp' },
        },
        {
            id: 'rope',
            index: 'rope',
            name: 'Corda (15m)',
            cost: { quantity: 1, unit: 'gp' },
        },
    ];
}
