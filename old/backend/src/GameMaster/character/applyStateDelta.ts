import type { CharacterStateDelta, EntityStateDelta, RuleCheckResult } from '../../rules/types.js';
import { PenaiDataSource } from '../database/data-source.js';
import { GameSession } from '../database/entities/GameSession.js';
import {
    getSessionHeroEntityId,
    loadHeroSessionStats,
    saveHeroSessionStats,
    type HeroSessionStats,
    type PenaiCoinPurse,
} from './heroStats.js';
import {
    addHeroInventoryItem,
    consumeHeroInventoryItem,
    setHeroItemEquipped,
} from './heroInventory.js';
import { applyCombatEntityDeltaPenai } from '../combat/engine.js';

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export type PenaiDeltaContext = {
    actionId?: string;
    actionType?: string;
};

export type PenaiDeltaApplicationSummary = {
    heroEntityId: string;
    stats: HeroSessionStats;
    applied: boolean;
};

function applyResourceDeltas(
    stats: HeroSessionStats,
    deltas: NonNullable<CharacterStateDelta['resources']>,
): void {
    for (const d of deltas) {
        const res = stats.resources.find(r => r.type === d.type && r.key === d.key);
        if (!res) continue;
        res.current = clamp(res.current + d.delta, 0, res.max);
    }
}

function applyCurrencyDelta(stats: HeroSessionStats, currency: CharacterStateDelta['currency']): void {
    if (!currency) return;
    const keys: (keyof PenaiCoinPurse)[] = ['pp', 'gp', 'ep', 'sp', 'cp'];
    for (const k of keys) {
        const delta = currency[k];
        if (typeof delta === 'number') {
            stats.coins[k] = Math.max(0, stats.coins[k] + delta);
        }
    }
}

export async function applyCharacterStateDeltaPenai(
    sessionId: number,
    delta: CharacterStateDelta,
    vitalsCtx?: { isCriticalDamage?: boolean; userId?: number },
): Promise<PenaiDeltaApplicationSummary | null> {
    const heroEntityId = await getSessionHeroEntityId(sessionId);
    if (!heroEntityId) return null;

    const stats = await loadHeroSessionStats(sessionId, heroEntityId);
    const prevHp = stats.hp;
    let changed = false;
    let hpTouched = false;

    if (delta.hp) {
        if (delta.hp.setToMax) {
            stats.hp = stats.maxHp;
            changed = true;
            hpTouched = true;
        }
        if (typeof delta.hp.delta === 'number') {
            stats.hp = clamp(stats.hp + delta.hp.delta, 0, stats.maxHp);
            changed = true;
            hpTouched = true;
        }
    }

    if (delta.resources?.length) {
        applyResourceDeltas(stats, delta.resources);
        changed = true;
    }

    if (delta.currency) {
        applyCurrencyDelta(stats, delta.currency);
        changed = true;
    }

    if (delta.inventory?.length) {
        for (const entry of delta.inventory) {
            if (!entry.quantityDelta) continue;
            const itemKey = entry.itemIndex ?? String(entry.itemId ?? '');
            if (!itemKey) continue;
            if (entry.quantityDelta > 0) {
                await addHeroInventoryItem({
                    sessionId,
                    heroEntityId,
                    itemKey,
                    name: entry.name ?? itemKey,
                    quantity: entry.quantityDelta,
                    itemData: entry.itemData,
                });
                if (entry.itemData?.equipped === true) {
                    await setHeroItemEquipped({
                        sessionId,
                        heroEntityId,
                        itemKey,
                        equipped: true,
                    });
                }
            } else {
                await consumeHeroInventoryItem({
                    sessionId,
                    heroEntityId,
                    itemKey,
                    itemId: entry.itemId ? String(entry.itemId) : undefined,
                    quantity: Math.abs(entry.quantityDelta),
                });
            }
        }
        changed = true;
    }

    if (changed) {
        await saveHeroSessionStats(sessionId, heroEntityId, stats);
        await import('./syncHeroHp.js').then(m => m.syncHeroHpPenai(sessionId));
    }

    if (hpTouched) {
        const damageWhileDown = prevHp <= 0 && typeof delta.hp?.delta === 'number' && delta.hp.delta < 0;
        await import('./heroVitalsService.js').then(m =>
            m.syncHeroVitalsAfterHpChange(sessionId, {
                prevHp,
                damageWhileDown,
                isCritical: Boolean(vitalsCtx?.isCriticalDamage),
                userId: vitalsCtx?.userId,
            }),
        );
    }

    const refreshed = await loadHeroSessionStats(sessionId, heroEntityId);
    return { heroEntityId, stats: refreshed, applied: changed };
}

export async function applyResultingStateDeltaPenai(
    sessionId: number,
    delta: RuleCheckResult['stateDelta'],
    _context?: PenaiDeltaContext,
): Promise<PenaiDeltaApplicationSummary | null> {
    if (!delta) return null;

    let summary: PenaiDeltaApplicationSummary | null = null;

    if (delta.character) {
        summary = await applyCharacterStateDeltaPenai(sessionId, delta.character);
    }

    if (delta.entities?.length) {
        for (const entityDelta of delta.entities) {
            await applyCombatEntityDeltaPenai(sessionId, entityDelta);
        }
    }

    return summary;
}

export async function bumpSessionStateVersion(sessionId: number): Promise<number> {
    const repo = PenaiDataSource.getRepository(GameSession);
    const session = await repo.findOne({ where: { id: sessionId } });
    if (!session) return 0;
    session.stateVersion += 1;
    await repo.save(session);
    return session.stateVersion;
}
