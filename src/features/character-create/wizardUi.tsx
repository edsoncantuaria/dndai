'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export function WizardSection({
  eyebrow,
  title,
  description,
  action,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-xl border border-dnd-gold/20 bg-dnd-obsidian-raised/90 shadow-[var(--dnd-shadow-card)]',
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-dnd-gold/10 px-4 py-3 sm:px-5 sm:py-4">
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.28em] text-dnd-ember">{eyebrow}</p>
          ) : null}
          <h3 className="font-display text-lg text-dnd-parchment sm:text-xl">{title}</h3>
          {description ? (
            <p className="mt-1 font-narrative text-sm leading-relaxed text-dnd-parchment-muted">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className="px-4 py-4 sm:px-5 sm:py-5">{children}</div>
    </section>
  );
}

export function WizardPickCard({
  title,
  subtitle,
  selected,
  onClick,
  disabled,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'group relative flex min-h-[3.25rem] w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dnd-gold/50',
        selected
          ? 'border-dnd-gold bg-dnd-gold/10 shadow-[0_0_0_1px_rgba(212,175,55,0.35)]'
          : 'border-dnd-gold/15 bg-dnd-obsidian/60 hover:border-dnd-gold/35 hover:bg-dnd-mist',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
          selected ? 'border-dnd-gold bg-dnd-gold text-dnd-obsidian' : 'border-dnd-gold/30 bg-transparent',
        )}
        aria-hidden
      >
        {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-base leading-tight text-dnd-parchment">{title}</span>
        {subtitle ? (
          <span className="mt-0.5 block font-ui text-xs leading-snug text-dnd-parchment-muted">{subtitle}</span>
        ) : null}
      </span>
    </button>
  );
}

export function WizardDetailPanel({
  title,
  children,
  empty,
  isEmpty,
}: {
  title: string;
  children: ReactNode;
  empty: string;
  isEmpty?: boolean;
}) {
  if (isEmpty) {
    return (
      <div className="rounded-lg border border-dashed border-dnd-gold/20 bg-dnd-obsidian/40 px-4 py-8 text-center">
        <p className="font-ui text-sm text-dnd-parchment-muted">{empty}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dnd-gold/20 bg-dnd-obsidian/80 p-4 sm:p-5">
      <p className="font-ui text-[10px] font-bold uppercase tracking-[0.24em] text-dnd-gold">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function WizardPickGrid({ children, columns = 2 }: { children: ReactNode; columns?: 1 | 2 | 3 }) {
  return (
    <div
      className={cn(
        'grid gap-2',
        columns === 1 && 'grid-cols-1',
        columns === 2 && 'grid-cols-1 sm:grid-cols-2',
        columns === 3 && 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
      )}
    >
      {children}
    </div>
  );
}
