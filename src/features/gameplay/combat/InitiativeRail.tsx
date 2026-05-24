'use client';

import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Skull } from 'lucide-react';
import type { Combatant } from '@/types';
import { cn } from '@/lib/utils';
import { getCombatantId } from './useCombatTrackerData';

const attitudeBorder: Record<NonNullable<Combatant['attitude']>, string> = {
  ally: 'border-dnd-success/50',
  neutral: 'border-dnd-parchment-muted/40',
  hostile: 'border-dnd-danger/50',
};

export function InitiativeRail({
  combatants,
  currentId,
  round,
}: {
  combatants: Combatant[];
  currentId: string;
  round: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [currentId]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-0.5">
        <span className="font-ui text-[10px] uppercase tracking-wider text-dnd-parchment-muted">
          Iniciativa
        </span>
        <span className="font-ui text-xs tabular-nums text-dnd-gold">Rodada {round}</span>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
        aria-label="Ordem de iniciativa"
      >
        {combatants.map((c) => {
          const id = getCombatantId(c);
          const isActive = id === currentId;
          const attitude = c.attitude ?? (c.isPlayer ? 'ally' : 'hostile');
          const hp =
            typeof c.hp === 'object'
              ? c.hp
              : { current: typeof c.hp === 'number' ? c.hp : 0, max: c.maxHp ?? 1 };
          const pct = hp.max > 0 ? Math.max(0, Math.min(100, (hp.current / hp.max) * 100)) : 0;

          return (
            <button
              key={id}
              ref={isActive ? activeRef : undefined}
              type="button"
              role="listitem"
              aria-current={isActive ? 'step' : undefined}
              className={cn(
                'relative flex w-[88px] shrink-0 flex-col rounded-md border px-2 py-1.5 text-left transition-all',
                'bg-dnd-obsidian-raised/80',
                attitudeBorder[attitude],
                isActive && 'ring-2 ring-dnd-gold/70 shadow-[0_0_12px_var(--dnd-gold-glow)]',
                c.isDead && 'opacity-45'
              )}
            >
              {isActive ? (
                <motion.span
                  layoutId="initiative-active"
                  className="pointer-events-none absolute inset-0 rounded-md bg-dnd-gold/10"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              ) : null}
              <span className="relative z-[1] truncate font-ui text-[11px] font-semibold text-dnd-parchment">
                {c.isDead ? <Skull className="mr-0.5 inline h-3 w-3 text-dnd-parchment-muted" /> : null}
                {c.name}
              </span>
              <span className="relative z-[1] font-mono text-[10px] text-dnd-parchment-muted">
                {c.initiative ?? '—'} ini
              </span>
              <div className="relative z-[1] mt-1 h-1 overflow-hidden rounded-full bg-dnd-obsidian">
                <motion.div
                  className={cn(
                    'h-full rounded-full',
                    pct > 50 ? 'bg-dnd-success' : pct > 25 ? 'bg-dnd-gold' : 'bg-dnd-danger'
                  )}
                  initial={false}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
