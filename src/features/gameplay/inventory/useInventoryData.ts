'use client';

import { useMemo } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import type { InventoryItem } from '@/types';
import { translateEquipment } from '@/utils/translator';
import { calculateWeight } from '@/utils/characterUtils';
import { COIN_WEIGHT } from '@/utils/currency';

export const COIN_TYPES = ['pp', 'gp', 'ep', 'sp', 'cp'] as const;
const COIN_INDEX_SET = new Set<string>(COIN_TYPES);

export type DisplayInventoryItem = InventoryItem & {
  _instanceKey: string;
  _stackSize?: number;
  _stackPosition?: number;
};

const toPositiveInteger = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.floor(parsed));
};

export const expandInventoryForDisplay = (items: InventoryItem[] | undefined | null): DisplayInventoryItem[] => {
  if (!Array.isArray(items)) return [];
  const expanded: DisplayInventoryItem[] = [];
  for (const original of items) {
    if (!original) continue;
    const normalizedIndex = typeof original.index === 'string' ? original.index.toLowerCase() : '';
    const isCurrency = normalizedIndex ? COIN_INDEX_SET.has(normalizedIndex) : false;
    const quantity = toPositiveInteger(original.quantity ?? 1);
    if (quantity <= 1 || isCurrency) {
      expanded.push({
        ...original,
        _instanceKey: `${original.id || original.index || original.name || 'item'}-0`,
      });
      continue;
    }
    for (let i = 0; i < quantity; i++) {
      expanded.push({
        ...original,
        quantity: 1,
        _instanceKey: `${original.id || original.index || original.name || 'item'}-${i}`,
        _stackSize: quantity,
        _stackPosition: i + 1,
      });
    }
  }
  return expanded;
};

const isCoinIndex = (value?: string | null) => {
  if (!value) return false;
  return COIN_INDEX_SET.has(value.toLowerCase());
};

export function useInventoryData() {
  const { character, combatState, isLoading, playerRollRequest } = useGameStateContext();

  return useMemo(() => {
    if (!character) return null;

    const coinCount =
      (character.currency?.pp ?? 0) +
      (character.currency?.gp ?? 0) +
      (character.currency?.ep ?? 0) +
      (character.currency?.sp ?? 0) +
      (character.currency?.cp ?? 0);
    const fallbackWeight =
      calculateWeight(character.inventory ?? []) + coinCount * COIN_WEIGHT;
    const currentWeight = Number(
      character.currentWeight != null && character.currentWeight > 0
        ? character.currentWeight
        : fallbackWeight
    );
    const carryingCapacity = Number(
      character.carryingCapacity ?? (character.attributes?.strength ? character.attributes.strength * 15 : 0)
    );
    const loadPercentage = carryingCapacity > 0 ? (currentWeight / carryingCapacity) * 100 : 0;

    const isPlayerTurn = combatState?.isActive
      ? character.id != null && combatState.combatants[combatState.turn]?.id === character.id.toString()
      : true;
    const actionDisabled = isLoading || !!playerRollRequest || !isPlayerTurn;

    const currency = {
      pp: character.currency?.pp ?? 0,
      gp: character.currency?.gp ?? 0,
      ep: character.currency?.ep ?? 0,
      sp: character.currency?.sp ?? 0,
      cp: character.currency?.cp ?? 0,
    };

    const inventoryItems: DisplayInventoryItem[] = expandInventoryForDisplay(character.inventory).map((item) => ({
      ...translateEquipment(item),
      _instanceKey: item._instanceKey,
      _stackSize: item._stackSize,
      _stackPosition: item._stackPosition,
    }));

    const weapons = inventoryItems.filter((i) => i.weapon_category);
    const armors = inventoryItems.filter(
      (i) => i.armor_category || i.equipment_category?.index === 'shields'
    );
    const magicItems = inventoryItems.filter((i) => i.name.includes('(Mágico)'));
    const otherItems = inventoryItems.filter(
      (i) =>
        !i.weapon_category &&
        !i.armor_category &&
        i.equipment_category?.index !== 'shields' &&
        !i.name.includes('(Mágico)') &&
        !isCoinIndex(i.index)
    );

    return {
      character,
      currentWeight,
      carryingCapacity,
      loadPercentage,
      actionDisabled,
      currency,
      weapons,
      armors,
      magicItems,
      otherItems,
    };
  }, [character, combatState, isLoading, playerRollRequest]);
}
