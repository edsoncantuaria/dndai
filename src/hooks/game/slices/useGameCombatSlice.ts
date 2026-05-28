'use client';

import { useMemo } from 'react';
import type { useInteractionManager } from '@/hooks/useInteractionManager';

type InteractionState = ReturnType<typeof useInteractionManager>;

/** F.2 — combate, rolagens e modais de loot/loja ligados ao motor. */
export function useGameCombatSlice(interaction: InteractionState) {
    return useMemo(
        () => ({
            combatState: interaction.combatState,
            setCombatState: interaction.setCombatState,
            playerRollRequest: interaction.playerRollRequest,
            pendingLootOffer: interaction.pendingLootOffer,
            shopState: interaction.shopState,
            levelUpState: interaction.levelUpState,
            pendingHitDiceRequest: interaction.pendingHitDiceRequest,
            handleTakeLoot: interaction.handleTakeLoot,
            handleBuyItem: interaction.handleBuyItem,
            handleSellItem: interaction.handleSellItem,
            handleOpenShop: interaction.handleOpenShop,
            handleCloseShop: interaction.handleCloseShop,
            handleStartEncounter: interaction.handleStartEncounter,
            nextTurn: interaction.nextTurn,
            triggerTestShop: interaction.triggerTestShop,
            triggerTestCombat: interaction.triggerTestCombat,
        }),
        [
            interaction.combatState,
            interaction.setCombatState,
            interaction.playerRollRequest,
            interaction.pendingLootOffer,
            interaction.shopState,
            interaction.levelUpState,
            interaction.pendingHitDiceRequest,
            interaction.handleTakeLoot,
            interaction.handleBuyItem,
            interaction.handleSellItem,
            interaction.handleOpenShop,
            interaction.handleCloseShop,
            interaction.handleStartEncounter,
            interaction.nextTurn,
            interaction.triggerTestShop,
            interaction.triggerTestCombat,
        ],
    );
}

export type GameCombatSlice = ReturnType<typeof useGameCombatSlice>;
