import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import { addHeroInventoryItem } from '../character/heroInventory.js';
import { applyCharacterStateDeltaPenai } from '../character/applyStateDeltaPenai.js';
import { getSessionHeroEntityId } from '../character/heroStats.js';
import type { PenaiCoinPurse } from '../character/heroStats.js';

const COIN_KEYS: (keyof PenaiCoinPurse)[] = ['pp', 'gp', 'ep', 'sp', 'cp'];

export async function getPendingLootOfferPenai(
    sessionId: number,
): Promise<Record<string, unknown> | null> {
    const session = await PenaiDataSource.getRepository(GameSession).findOne({
        where: { id: sessionId },
    });
    return session?.pendingLootOffer ?? null;
}

export async function persistPendingLootOfferPenai(
    sessionId: number,
    offer: Record<string, unknown> | null,
): Promise<void> {
    const repo = PenaiDataSource.getRepository(GameSession);
    const session = await repo.findOne({ where: { id: sessionId } });
    if (!session) return;
    session.pendingLootOffer = offer;
    await repo.save(session);
}

export async function applyLootOfferPenai(
    sessionId: number,
    lootOffer: Record<string, unknown>,
): Promise<void> {
    const heroEntityId = await getSessionHeroEntityId(sessionId);
    if (!heroEntityId) throw new Error('Herói não encontrado');

    const items = Array.isArray(lootOffer.items) ? lootOffer.items : [];
    for (const raw of items) {
        if (!raw || typeof raw !== 'object') continue;
        const item = raw as Record<string, unknown>;
        const itemKey =
            typeof item.index === 'string'
                ? item.index
                : typeof item.itemKey === 'string'
                  ? item.itemKey
                  : 'loot-item';
        await addHeroInventoryItem({
            sessionId,
            heroEntityId,
            itemKey,
            name: typeof item.name === 'string' ? item.name : itemKey,
            quantity: Math.max(1, Number(item.quantity ?? 1)),
            itemData: item,
        });
    }

    const currency = lootOffer.currency;
    if (currency && typeof currency === 'object') {
        const delta: Partial<PenaiCoinPurse> = {};
        for (const coin of COIN_KEYS) {
            const value = Number((currency as Record<string, unknown>)[coin]);
            if (Number.isFinite(value) && value > 0) delta[coin] = value;
        }
        if (Object.keys(delta).length) {
            await applyCharacterStateDeltaPenai(sessionId, { currency: delta });
        }
    }
}

export async function claimPendingLootPenai(sessionId: number): Promise<void> {
    const pending = await getPendingLootOfferPenai(sessionId);
    if (!pending) throw new Error('Não há loot pendente para coletar.');
    await applyLootOfferPenai(sessionId, pending);
    await persistPendingLootOfferPenai(sessionId, null);
}

export function buildCombatVictoryLootPenai(opts: {
    hostileCount: number;
    round: number;
}): Record<string, unknown> {
    const gp = Math.max(5, opts.hostileCount * 12 + Math.max(0, opts.round - 1) * 3);
    return { items: [], currency: { gp }, origin: 'penai-combat' };
}
