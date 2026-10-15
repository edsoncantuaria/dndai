'use client';

import { useCallback, useMemo } from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import type { Combatant } from '@/types';

export function getCombatantId(combatantOrId: unknown): string {
  if (!combatantOrId) return '';
  if (typeof combatantOrId === 'string') return combatantOrId;
  const entry = combatantOrId as { id?: string; name?: string };
  return entry.id || entry.name || '';
}

export function useCombatTrackerData() {
  const { combatState, character, log } = useGameStateContext();

  const rollEntries = useMemo(
    () => (log || []).filter((entry) => entry?.type === 'roll' && typeof entry.content === 'string'),
    [log]
  );

  const buildRollHistory = useCallback(
    (name?: string) => {
      if (!name) return [];
      const key = name.toLowerCase();
      return rollEntries
        .filter((entry) => (entry.content as string).toLowerCase().includes(key))
        .slice(-5)
        .map((entry) => {
          const content = entry.content as string;
          const totalMatch = content.match(/(\d+)(?!.*\d)/);
          const diceMatch = content.match(/(\d+d\d+)/i);
          return {
            type: 'log',
            description: content,
            total: totalMatch ? Number(totalMatch[1]) : undefined,
            dice: diceMatch ? diceMatch[1] : undefined,
            rolls: [] as number[],
          };
        });
    },
    [rollEntries]
  );

  const allCombatants = useMemo<Combatant[]>(() => {
    if (!combatState.isActive || !character) return [];

    const combatantMap = new Map<string, Combatant>();

    const playerCombatant: Combatant = {
      id: 'player',
      name: character.name,
      hp: { current: character.hp.current, max: character.hp.max },
      ac: character.ac.value,
      isPlayer: true,
      attitude: 'ally',
      initiative: 0,
      isDead: character.hp.current <= 0,
      hasMoved: false,
      hasActed: false,
      actionPoints: 3,
      bonusActionPoints: 1,
      conditions: character.conditions.map((c) => c.name),
      rollHistory: buildRollHistory(character.name),
    };
    combatantMap.set('player', playerCombatant);

    (combatState.combatants || []).forEach((apiCombatant) => {
      if (!apiCombatant?.name) return;

      const id = getCombatantId(apiCombatant);
      if (!id) return;

      const isPlayer = id === 'player';
      const attitude = (apiCombatant.attitude as Combatant['attitude']) ?? (isPlayer ? 'ally' : 'hostile');
      const existing = combatantMap.get(id) || (isPlayer ? playerCombatant : ({} as Combatant));

      const currentHp =
        typeof apiCombatant.hp === 'object' && apiCombatant.hp !== null
          ? apiCombatant.hp.current
          : typeof apiCombatant.hp === 'number'
            ? apiCombatant.hp
            : 1;
      const maxHp =
        typeof apiCombatant.hp === 'object' && apiCombatant.hp !== null
          ? apiCombatant.hp.max
          : (apiCombatant.maxHp ?? 1);

      combatantMap.set(id, {
        ...existing,
        ...apiCombatant,
        id,
        isPlayer,
        attitude,
        hp: { current: currentHp, max: maxHp },
        ac: apiCombatant.ac ?? existing.ac ?? 10,
        isDead: apiCombatant.isDead ?? currentHp <= 0,
        rollHistory:
          apiCombatant.rollHistory && apiCombatant.rollHistory.length
            ? apiCombatant.rollHistory
            : buildRollHistory(apiCombatant.name ?? id),
      });
    });

    const validCombatants = Array.from(combatantMap.values());

    if (!combatState.initiativeOrder?.length) {
      return validCombatants.sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0));
    }

    return combatState.initiativeOrder
      .map((orderEntry) => combatantMap.get(getCombatantId(orderEntry)))
      .filter((c): c is Combatant => c !== undefined);
  }, [combatState, character, buildRollHistory]);

  const { round, turn, initiativeOrder } = combatState;

  const currentCombatantIndex =
    initiativeOrder?.length ? turn % initiativeOrder.length : 0;
  const currentCombatantId = initiativeOrder?.length
    ? getCombatantId(initiativeOrder[currentCombatantIndex])
    : '';
  const currentCombatant = allCombatants.find((c) => getCombatantId(c) === currentCombatantId);

  const upcomingCombatants = useMemo(() => {
    if (allCombatants.length <= 1 || !initiativeOrder?.length) return [];
    const list: Combatant[] = [];
    for (let i = 1; i < allCombatants.length; i++) {
      const nextIndex = (currentCombatantIndex + i) % initiativeOrder.length;
      const nextId = getCombatantId(initiativeOrder[nextIndex]);
      const next = allCombatants.find((c) => getCombatantId(c) === nextId);
      if (next && !next.isDead) list.push(next);
    }
    return list;
  }, [allCombatants, initiativeOrder, currentCombatantIndex]);

  const isPlayerTurn = Boolean(
    currentCombatant?.isPlayer ||
      currentCombatant?.attitude === 'ally' ||
      (currentCombatant as { side?: string } | undefined)?.side === 'ally',
  );

  const ready =
    combatState.isActive &&
    allCombatants.length > 0 &&
    Boolean(initiativeOrder?.length);

  return {
    ready,
    allCombatants,
    currentCombatant,
    currentCombatantId,
    upcomingCombatants,
    isPlayerTurn,
    round,
    turn,
  };
}
