'use client';

import { useEffect } from 'react';
import { usePenaiGameplay } from '@/contexts/PenaiGameplayContext';
import { useGameStateContext } from '@/contexts/GameStateContext';
import type { CombatState, LootOffer, ShopState } from '@/types';

function mapPenaiCombat(raw: Record<string, unknown>): CombatState {
    const combatants = Array.isArray(raw.combatants)
        ? (raw.combatants as Array<Record<string, unknown>>).map(c => ({
              id: String(c.entityKey ?? c.id ?? ''),
              name: String(c.displayName ?? c.name ?? 'Combatente'),
              isPlayer: c.side === 'hero',
              hp: { current: Number(c.hp ?? 0), max: Number(c.hpMax ?? 1) },
              ac: Number(c.armorClass ?? 10),
              initiative: Number(c.initiative ?? 10),
              hasMoved: false,
              hasActed: false,
              actionPoints: 3,
              bonusActionPoints: 1,
              conditions: [],
              rollHistory: [],
          }))
        : [];

    const initiativeOrder = Array.isArray(raw.initiativeOrder)
        ? (raw.initiativeOrder as string[])
        : combatants.map(c => c.id);

    return {
        isActive: Boolean(raw.isActive),
        round: Number(raw.round ?? 1),
        turn: Number(raw.turn ?? 0),
        initiativeOrder,
        combatants,
    };
}

/** Sincroniza mechanicalStateUpdate / gameStateUpdate PENAI → GameStateContext (UI legada). */
export function usePenaiMechanicalSync() {
    const penai = usePenaiGameplay();
    const ctx = useGameStateContext();

    useEffect(() => {
        if (!penai.active || !penai.lastMechanical) return;
        const m = penai.lastMechanical;

        if (m.combatState && typeof m.combatState === 'object') {
            ctx.setCombatState(mapPenaiCombat(m.combatState as Record<string, unknown>));
        }

        const shop = m.shopState as Record<string, unknown> | null | undefined;
        if (shop && typeof shop === 'object' && Array.isArray(shop.inventory)) {
            ctx.setRequest({
                type: 'shop',
                request: {
                    isOpen: true,
                    isHaggling: false,
                    name: String(shop.name ?? 'Loja'),
                    inventory: shop.inventory,
                    sellPrices: {},
                } as ShopState,
            });
        }

        const loot = m.pendingLootOffer as LootOffer | null | undefined;
        if (loot && typeof loot === 'object') {
            ctx.setRequest({ type: 'loot', request: loot });
        }

        const actionOptions = m.actionOptions as
            | (string | { text: string; action: string; skill?: string })[]
            | undefined;
        if (Array.isArray(actionOptions) && actionOptions.length > 0) {
            ctx.setActionOptions(actionOptions);
        }

        const levelUp = m.levelUpState as import('@/types').LevelUpState | null | undefined;
        if (levelUp && typeof levelUp === 'object' && levelUp.isPending) {
            (ctx.setRequest as (args: { type: string; request: unknown }) => void)({
                type: 'levelUp',
                request: levelUp,
            });
        }

        const ch = m.character as Record<string, unknown> | null | undefined;
        if (ch && ctx.character) {
            ctx.setCharacter({
                ...ctx.character,
                level: Number(ch.level ?? ctx.character.level),
                attributes: {
                    ...ctx.character.attributes,
                    hp: Number(ch.hp ?? ctx.character.attributes?.hp),
                    maxHp: Number(ch.maxHp ?? ctx.character.attributes?.maxHp),
                    ac: Number(ch.ac ?? ctx.character.attributes?.ac),
                },
                spells: Array.isArray(ch.spells)
                    ? (ch.spells as typeof ctx.character.spells)
                    : ctx.character.spells,
                coins: (ch.coins as typeof ctx.character.coins) ?? ctx.character.coins,
                inventory: Array.isArray(ch.inventory)
                    ? (ch.inventory as typeof ctx.character.inventory)
                    : ctx.character.inventory,
                currentRegion: String(m.currentRegionSlug ?? ctx.character.currentRegion),
                worldState: {
                    ...ctx.character.worldState,
                    ...(m.worldState as Record<string, unknown> | undefined),
                },
            });
        } else if (m.worldState && ctx.character) {
            ctx.setCharacter({
                ...ctx.character,
                worldState: {
                    ...ctx.character.worldState,
                    ...(m.worldState as Record<string, unknown>),
                },
            });
        }
    }, [penai.active, penai.lastMechanical, ctx]);
}
