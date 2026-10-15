'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Loader2, Swords } from 'lucide-react';
import { useGameStateContext } from '@/contexts/GameStateContext';
import { DndButton } from '@/components/primitives';
import StructuredAttackPanel from '@/components/StructuredAttackPanel';
import { cn } from '@/lib/utils';
import { useCombatTrackerData } from './useCombatTrackerData';
import { InitiativeRail } from './InitiativeRail';
import { CombatantCardV2 } from './CombatantCardV2';

/** HUD de combate v2 — trilho de iniciativa CRPG + cartões com HP animado */
export function GameplayCombatTracker() {
  const { nextTurn, isLoading } = useGameStateContext();
  const [detailsOpen, setDetailsOpen] = useState(true);

  const {
    ready,
    allCombatants,
    currentCombatant,
    currentCombatantId,
    upcomingCombatants,
    isPlayerTurn,
    round,
  } = useCombatTrackerData();

  if (!ready) return null;

  return (
    <motion.div
      className={cn(
        'relative overflow-hidden rounded-lg border border-dnd-gold/20 bg-dnd-obsidian-raised',
        isPlayerTurn
          ? 'shadow-[0_0_24px_rgba(228,7,18,0.25)] ring-1 ring-dnd-ember/40'
          : 'shadow-[0_0_12px_rgba(0,0,0,0.45)]'
      )}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      layout
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className={cn(
            'absolute inset-0 bg-gradient-to-r opacity-30',
            isPlayerTurn ? 'from-dnd-gold/15 to-transparent' : 'from-dnd-ember/15 to-transparent'
          )}
        />
        {isPlayerTurn ? (
          <div className="absolute inset-0 animate-pulse bg-dnd-ember/10" />
        ) : null}
      </div>

      <div className="relative space-y-3 p-3">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 text-left"
          onClick={() => setDetailsOpen((o) => !o)}
          aria-expanded={detailsOpen}
        >
          <h3 className="flex items-center gap-2 font-display text-sm text-dnd-gold md:text-base">
            <Swords className="h-4 w-4 shrink-0" />
            Combate
          </h3>
          <div className="flex items-center gap-2">
            {currentCombatant && !detailsOpen ? (
              <span className="hidden font-ui text-xs text-dnd-parchment-muted sm:inline">
                {currentCombatant.name}
              </span>
            ) : null}
            <ChevronDown
              className={cn(
                'h-5 w-5 text-dnd-parchment-muted transition-transform',
                detailsOpen && 'rotate-180'
              )}
            />
          </div>
        </button>

        <InitiativeRail combatants={allCombatants} currentId={currentCombatantId} round={round} />

        <AnimatePresence initial={false}>
          {detailsOpen ? (
            <motion.div
              key="combat-details"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <div className="max-h-[50vh] space-y-3 overflow-y-auto pt-1">
                {currentCombatant ? (
                  <div className="space-y-2">
                    <p className="font-ui text-[10px] uppercase tracking-wider text-dnd-gold">
                      Turno atual
                    </p>
                    <CombatantCardV2 combatant={currentCombatant} isCurrentTurn />
                  </div>
                ) : null}

                {upcomingCombatants.length > 0 ? (
                  <div className="space-y-2">
                    <p className="font-ui text-[10px] uppercase tracking-wider text-dnd-parchment-muted">
                      Próximos
                    </p>
                    <div className="space-y-2">
                      {upcomingCombatants.map((c) => (
                        <CombatantCardV2 key={c.id} combatant={c} isCurrentTurn={false} compact />
                      ))}
                    </div>
                  </div>
                ) : null}

                {isPlayerTurn ? (
                  <div className="border-t border-dnd-gold/10 pt-2">
                    <StructuredAttackPanel variant="v2" />
                  </div>
                ) : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {!isPlayerTurn ? (
          <DndButton variant="ember" className="w-full" disabled={isLoading} onClick={nextTurn}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Próximo turno'}
          </DndButton>
        ) : null}
      </div>
    </motion.div>
  );
}
