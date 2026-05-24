import type { LootOffer } from '../schemas/gameSchemas.js';
import { persistPendingLootOffer, getPendingLootOffer } from './inventoryMotorService.js';

export type CombatLootContext = {
    hostileCount: number;
    round: number;
    difficulty?: 'easy' | 'medium' | 'hard';
};

/** Gera loot mínimo autoritativo ao fim de um encontro (sem depender da IA). */
export function buildCombatVictoryLoot(ctx: CombatLootContext): LootOffer {
    const hostiles = Math.max(1, ctx.hostileCount);
    const roundBonus = Math.max(0, ctx.round - 1) * 3;
    const difficultyMultiplier =
        ctx.difficulty === 'hard' ? 1.5 : ctx.difficulty === 'easy' ? 0.75 : 1;
    const gp = Math.round((hostiles * 12 + roundBonus) * difficultyMultiplier);

    return {
        items: [],
        currency: { gp: Math.max(5, gp) },
        origin: 'motor-combat',
    } as LootOffer;
}

export async function stageMotorLootOffer(
    sessionId: number,
    loot: LootOffer | Record<string, unknown>,
): Promise<void> {
    const existing = await getPendingLootOffer(sessionId);
    if (existing) {
        const existingGp = Number((existing.currency as Record<string, unknown>)?.gp ?? 0);
        const nextGp = Number((loot as Record<string, unknown>).currency &&
            typeof (loot as Record<string, unknown>).currency === 'object'
            ? ((loot as Record<string, unknown>).currency as Record<string, unknown>).gp
            : 0);
        if (existingGp >= nextGp) return;
    }
    await persistPendingLootOffer(sessionId, loot as Record<string, unknown>);
}

export async function getMotorLootOfferForClient(
    sessionId: number,
): Promise<Record<string, unknown> | null> {
    return getPendingLootOffer(sessionId);
}
