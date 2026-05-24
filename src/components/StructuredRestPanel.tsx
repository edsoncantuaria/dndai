import React from 'react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { DndButton, DndCard } from '@/components/primitives';
import { structuredPanelTitleClass } from '@/features/gameplay/modals/structuredPanelStyles';
import { cn } from '@/lib/utils';

export interface StructuredRestPanelProps {
  variant?: 'legacy' | 'v2';
}

const StructuredRestPanel: React.FC<StructuredRestPanelProps> = ({ variant = 'legacy' }) => {
  const isV2 = variant === 'v2';
  const { processPlayerAction, isLoading, setPendingStructuredIntent, combatState } = useGameStateContext();
  const isCombatActive = combatState?.isActive;

  const handleRest = (restType: 'short' | 'long') => {
    setPendingStructuredIntent({
      type: 'rest',
      payload: { restType },
    });
    processPlayerAction(
      restType === 'short'
        ? 'Quero fazer um descanso curto para recuperar o fôlego.'
        : 'Organizo um descanso longo para recuperar minhas forças.'
    );
  };

  const body = (
    <>
      <p className={structuredPanelTitleClass(variant)}>Descansar</p>
      <p className={isV2 ? 'font-ui text-xs text-dnd-parchment-muted' : 'text-xs text-stone-400'}>
        Aplique as regras oficiais de descanso.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {isV2 ? (
          <>
            <DndButton
              type="button"
              variant="goldOutline"
              size="sm"
              disabled={isCombatActive || isLoading}
              onClick={() => handleRest('short')}
            >
              Curto
            </DndButton>
            <DndButton
              type="button"
              variant="ghost"
              size="sm"
              disabled={isCombatActive || isLoading}
              onClick={() => handleRest('long')}
            >
              Longo
            </DndButton>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => handleRest('short')}
              disabled={isCombatActive || isLoading}
              className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 disabled:opacity-40"
            >
              Descanso curto
            </button>
            <button
              type="button"
              onClick={() => handleRest('long')}
              disabled={isCombatActive || isLoading}
              className="rounded-xl border border-blue-400/40 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-100 disabled:opacity-40"
            >
              Descanso longo
            </button>
          </>
        )}
      </div>
      {isCombatActive && (
        <p className={cn('mt-2 text-[11px]', isV2 ? 'font-ui text-dnd-danger' : 'text-red-300')}>
          Interrompa o combate antes de descansar.
        </p>
      )}
    </>
  );

  if (isV2) {
    return (
      <DndCard padding="sm" hover={false} className="border-dnd-gold/15">
        {body}
      </DndCard>
    );
  }

  return <div className="rounded-2xl border border-white/10 bg-black/30 p-3">{body}</div>;
};

export default StructuredRestPanel;
