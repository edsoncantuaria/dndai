'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  Heart,
  History,
  Shield,
  Skull,
  Zap,
  PlusSquare,
} from 'lucide-react';
import type { Combatant } from '@/types';
import { translateCondition } from '@/utils/translator';
import { DndCard } from '@/components/primitives';
import { cn } from '@/lib/utils';

const MAX_AP = 30;
const MAX_BONUS_AP = 3;

function hpValues(combatant: Combatant) {
  const current =
    typeof combatant.hp === 'object'
      ? combatant.hp.current
      : typeof combatant.hp === 'number'
        ? combatant.hp
        : 0;
  const max =
    typeof combatant.hp === 'object' ? combatant.hp.max : (combatant.maxHp ?? Math.max(current, 1));
  return { current, max };
}

export function CombatantCardV2({
  combatant,
  isCurrentTurn,
  compact = false,
}: {
  combatant: Combatant;
  isCurrentTurn: boolean;
  compact?: boolean;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const { current, max } = hpValues(combatant);
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;

  if (combatant.isDead) {
    return (
      <DndCard padding="sm" hover={false} className="flex items-center justify-between opacity-50 grayscale">
        <span className="flex items-center gap-2 font-ui text-sm text-dnd-parchment-muted line-through">
          <Skull className="h-4 w-4" />
          {combatant.name}
        </span>
        <span className="font-ui text-xs font-semibold uppercase text-dnd-danger">Derrotado</span>
      </DndCard>
    );
  }

  const attitude = combatant.attitude ?? (combatant.isPlayer ? 'ally' : 'hostile');
  const advantage = combatant.tempModifiers?.advantage;
  const disadvantage = combatant.tempModifiers?.disadvantage;

  return (
    <DndCard
      padding={compact ? 'sm' : 'md'}
      hover={false}
      className={cn(
        'border transition-shadow',
        isCurrentTurn ? 'border-dnd-ember/50 shadow-[0_0_16px_rgba(228,7,18,0.35)] animate-pulse' : 'border-dnd-gold/15',
        attitude === 'hostile' && !isCurrentTurn && 'border-dnd-danger/25',
        attitude === 'ally' && !isCurrentTurn && 'border-dnd-success/20'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4
            className={cn(
              'truncate font-display text-base',
              isCurrentTurn ? 'text-dnd-gold' : 'text-dnd-parchment'
            )}
          >
            {combatant.name}
          </h4>
          {!compact && (
            <div className="mt-1 flex flex-wrap gap-1">
              {(combatant.conditions || []).slice(0, 4).map((cond, i) => (
                <span
                  key={i}
                  className="rounded-full border border-dnd-gold/20 bg-dnd-obsidian px-1.5 py-0.5 font-ui text-[10px] text-dnd-parchment-muted"
                >
                  {translateCondition(cond)}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {advantage ? <ArrowUp className="h-4 w-4 text-dnd-success" title="Vantagem" /> : null}
          {disadvantage ? <ArrowDown className="h-4 w-4 text-dnd-danger" title="Desvantagem" /> : null}
          <button
            type="button"
            className="text-dnd-parchment-muted hover:text-dnd-gold"
            onClick={() => setShowHistory((v) => !v)}
            title="Histórico de rolagens"
          >
            <History className="h-4 w-4" />
          </button>
          <div className="text-center">
            <Shield className="mx-auto h-3 w-3 text-dnd-parchment-muted" />
            <span className="font-mono text-sm font-bold text-dnd-parchment">{combatant.ac ?? '?'}</span>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between font-ui text-[10px] uppercase tracking-wider text-dnd-parchment-muted">
          <span className="flex items-center gap-1">
            <Heart className="h-3 w-3 text-dnd-ember" />
            PV
          </span>
          <span className="font-mono tabular-nums text-dnd-parchment">
            {current} / {max}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-dnd-obsidian">
          <motion.div
            className={cn(
              'h-full rounded-full',
              pct > 50 ? 'bg-dnd-success' : pct > 25 ? 'bg-dnd-gold' : 'bg-dnd-danger'
            )}
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {!compact ? (
        <div className="mt-3 grid grid-cols-2 gap-2 font-ui text-xs">
          <div className="rounded-md border border-dnd-gold/10 bg-dnd-obsidian/60 px-2 py-1.5 text-center">
            <span className="flex items-center justify-center gap-1 text-dnd-parchment-muted">
              <Zap className="h-3 w-3" /> AP
            </span>
            <span className="font-mono text-base font-bold text-dnd-parchment">
              {combatant.actionPoints ?? 0}
              <span className="text-dnd-parchment-muted">/{MAX_AP}</span>
            </span>
          </div>
          <div className="rounded-md border border-dnd-gold/10 bg-dnd-obsidian/60 px-2 py-1.5 text-center">
            <span className="flex items-center justify-center gap-1 text-dnd-parchment-muted">
              <PlusSquare className="h-3 w-3" /> Bônus
            </span>
            <span className="font-mono text-base font-bold text-dnd-parchment">
              {combatant.bonusActionPoints ?? 0}
              <span className="text-dnd-parchment-muted">/{MAX_BONUS_AP}</span>
            </span>
          </div>
        </div>
      ) : null}

      {showHistory && combatant.rollHistory?.length ? (
        <div className="mt-2 max-h-24 overflow-y-auto rounded-md border border-dnd-gold/10 bg-dnd-obsidian/50 p-2 font-ui text-[11px] text-dnd-parchment-muted">
          {combatant.rollHistory.slice(-3).reverse().map((roll, i) => (
            <p key={i} className="truncate">
              {roll.description || roll.type || 'Rolagem'}
              {roll.total !== undefined ? `: ${roll.total}` : ''}
            </p>
          ))}
        </div>
      ) : null}
    </DndCard>
  );
}
