'use client';

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DndGameModalShellProps {
  title: React.ReactNode;
  eyebrow?: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose?: () => void;
  maxWidth?: string;
  className?: string;
  closeDisabled?: boolean;
  closeOnBackdrop?: boolean;
}

/** Moldura dourada + blur para modais de jogo (UI v2) */
export function DndGameModalShell({
  title,
  eyebrow,
  subtitle,
  children,
  footer,
  onClose,
  maxWidth = 'max-w-lg',
  className,
  closeDisabled,
  closeOnBackdrop = true,
}: DndGameModalShellProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex animate-fadeIn items-center justify-center bg-dnd-obsidian/80 p-4 backdrop-blur-md"
      onClick={closeOnBackdrop ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          'dnd-border-gold dnd-surface-glass flex max-h-[92vh] w-full flex-col overflow-hidden rounded-lg shadow-[var(--dnd-shadow-elevated)]',
          maxWidth,
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-dnd-gold/15 px-4 py-4 md:px-5">
          <div className="min-w-0">
            {eyebrow ? (
              <p className="font-ui text-[10px] uppercase tracking-[0.45em] text-dnd-gold">{eyebrow}</p>
            ) : null}
            <h2 className="font-display text-xl leading-snug text-dnd-parchment md:text-2xl">{title}</h2>
            {subtitle ? (
              <div className="mt-1 font-ui text-sm text-dnd-parchment-muted">{subtitle}</div>
            ) : null}
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              disabled={closeDisabled}
              className="shrink-0 rounded-md border border-dnd-gold/25 p-2 text-dnd-parchment-muted transition hover:border-dnd-gold/50 hover:text-dnd-gold disabled:opacity-40"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer ? (
          <footer className="shrink-0 border-t border-dnd-gold/15 bg-dnd-obsidian-raised/40 px-4 py-3 md:px-5">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

export const dndModalFieldClass =
  'mt-1 w-full min-h-[44px] rounded-md border border-dnd-gold/25 bg-dnd-obsidian-raised/90 px-3 py-2 font-ui text-sm text-dnd-parchment placeholder:text-dnd-parchment-muted/50 focus:border-dnd-gold/60 focus:outline-none focus:ring-2 focus:ring-dnd-gold/25';

export const dndModalLabelClass = 'font-ui text-sm text-dnd-parchment';

export const dndModalHintClass = 'font-ui text-xs text-dnd-parchment-muted';
