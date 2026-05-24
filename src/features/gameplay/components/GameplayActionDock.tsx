'use client';

import { useMemo, useState } from 'react';
import { Dice5, Loader2 } from 'lucide-react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { resolveLoadingState } from '@/hooks/game/loadingLabels';
import { DndButton } from '@/components/primitives';
import { ActionBar } from './ActionBar';
import { LoadingOracle } from './LoadingOracle';
import StructuredAttackPanel from '@/components/StructuredAttackPanel';
import StructuredSkillPanel from '@/components/StructuredSkillPanel';
import StructuredSpellPanel from '@/components/StructuredSpellPanel';
import StructuredRestPanel from '@/components/StructuredRestPanel';

function actionLabel(action: string | { text: string; action: string; skill?: string }): string {
  if (typeof action === 'string') return action;
  return action.text || action.action || '';
}

/** Painel de ações v2 — 4 slots + estados especiais do motor */
export function GameplayActionDock({ onFreeAction }: { onFreeAction: () => void }) {
  const {
    processPlayerAction,
    isLoading,
    actionOptions,
    pendingLootOffer,
    pendingHitDiceRequest,
    playerRollRequest,
    combatState,
    character,
    nextTurn,
    actionPhaseLabel,
    isRollPending,
    takeLoot,
    spendHitDice,
    declineHitDiceRequest,
  } = useGameStateContext();

  const [showStructuredTools, setShowStructuredTools] = useState(false);

  const loadingState = useMemo(
    () => resolveLoadingState({ isLoading, isRollPending, actionPhaseLabel }),
    [isLoading, isRollPending, actionPhaseLabel]
  );

  const isPlayerTurn = useMemo(() => {
    if (!combatState.isActive || !character) return !combatState.isActive;
    const order = combatState.initiativeOrder;
    if (!order?.length) return false;
    const current = order[combatState.turn % order.length];
    const currentId = typeof current === 'string' ? current : current?.id || current?.name || '';
    const player = combatState.combatants.find((c) => c.isPlayer);
    const playerId = player?.id || player?.name || '';
    return Boolean(playerId && currentId === playerId);
  }, [combatState, character]);

  const isActionLocked =
    Boolean(actionPhaseLabel) || isRollPending || !!pendingLootOffer || !!pendingHitDiceRequest || isLoading;

  const optionTexts = useMemo(
    () => actionOptions.map(actionLabel).filter(Boolean),
    [actionOptions]
  );

  const handleSelect = (index: number, text: string) => {
    const raw = actionOptions[index];
    if (!raw) {
      processPlayerAction(text);
      return;
    }
    const cmd =
      typeof raw === 'object' && raw.text
        ? raw.text
        : typeof raw === 'object' && raw.action
          ? raw.action
          : text;
    processPlayerAction(cmd);
  };

  if (combatState.isActive && !isPlayerTurn) {
    return (
      <div className="border-t border-dnd-gold/15 dnd-surface-glass px-4 py-3 pb-[calc(0.75rem+var(--dnd-safe-bottom))]">
        <p className="mb-3 text-center font-narrative text-sm italic text-dnd-parchment-muted">
          Aguardando turno dos outros combatentes…
        </p>
        <DndButton variant="ember" className="w-full" disabled={isLoading} onClick={nextTurn}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Próximo turno'}
        </DndButton>
      </div>
    );
  }

  if (playerRollRequest) {
    return (
      <div className="border-t border-dnd-gold/15 dnd-surface-glass px-4 py-4 pb-[calc(1rem+var(--dnd-safe-bottom))]">
        <div className="flex items-center justify-center gap-2 font-ui text-sm text-dnd-gold">
          <Dice5 className="h-5 w-5" />
          Aguardando sua rolagem de dados…
        </div>
      </div>
    );
  }

  if (pendingLootOffer) {
    return (
      <div className="border-t border-dnd-gold/15 dnd-surface-glass px-4 py-3 pb-[calc(0.75rem+var(--dnd-safe-bottom))]">
        <p className="font-display text-center text-dnd-gold">Tesouro encontrado</p>
        <DndButton variant="ember" className="mt-3 w-full" disabled={isLoading} onClick={() => takeLoot(true)}>
          Recolher tudo
        </DndButton>
      </div>
    );
  }

  if (pendingHitDiceRequest && character) {
    const maxDice = Math.min(pendingHitDiceRequest.maxDice || 0, character.hitDice.current || 0);
    return (
      <div className="border-t border-dnd-gold/15 dnd-surface-glass px-4 py-3 pb-[calc(0.75rem+var(--dnd-safe-bottom))]">
        <p className="font-ui text-sm text-dnd-parchment">Gastar dados de vida (máx. {maxDice})</p>
        <div className="mt-3 flex gap-2">
          <DndButton variant="ember" className="flex-1" disabled={isLoading || maxDice < 1} onClick={() => spendHitDice(1)}>
            Gastar 1
          </DndButton>
          <DndButton variant="ghost" className="flex-1" onClick={declineHitDiceRequest}>
            Agora não
          </DndButton>
        </div>
      </div>
    );
  }

  if (isLoading && !actionPhaseLabel) {
    return (
      <div className="border-t border-dnd-gold/15 dnd-surface-glass">
        <LoadingOracle label={loadingState.shortLabel ?? 'O mestre pensa…'} />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {loadingState.banner && !isActionLocked ? (
        <p className="px-3 py-1 text-center font-ui text-xs text-dnd-parchment-muted">{loadingState.banner}</p>
      ) : null}
      {showStructuredTools ? (
        <div className="max-h-48 space-y-2 overflow-y-auto border-b border-dnd-gold/10 px-3 py-2">
          <StructuredAttackPanel variant="v2" />
          <StructuredSkillPanel variant="v2" />
          <StructuredSpellPanel variant="v2" />
          <StructuredRestPanel variant="v2" />
        </div>
      ) : null}
      <div className="flex justify-end px-3 pt-1">
        <button
          type="button"
          className="font-ui text-[10px] uppercase tracking-wider text-dnd-parchment-muted hover:text-dnd-gold"
          onClick={() => setShowStructuredTools((v) => !v)}
        >
          {showStructuredTools ? 'Ocultar SRD' : 'Ferramentas SRD'}
        </button>
      </div>
      <ActionBar
        options={optionTexts}
        disabled={isActionLocked}
        statusLabel={isActionLocked ? loadingState.shortLabel ?? actionPhaseLabel ?? undefined : undefined}
        onSelect={handleSelect}
        onFreeAction={onFreeAction}
      />
    </div>
  );
}
