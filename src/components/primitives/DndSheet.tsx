'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useBreakpoint } from '@/hooks/useBreakpoint';

export interface DndSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
  side?: 'bottom' | 'right';
}

export function DndSheet({ open, onOpenChange, title, children, side }: DndSheetProps) {
  const { isMdUp } = useBreakpoint();
  const resolvedSide = side ?? (isMdUp ? 'right' : 'bottom');

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Fechar painel"
        className="fixed inset-0 z-40 bg-dnd-obsidian/75 backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby={title ? 'dnd-sheet-title' : undefined}
        className={cn(
          'fixed z-50 flex flex-col bg-dnd-obsidian-raised shadow-[var(--dnd-shadow-elevated)]',
          'border-dnd-gold/20',
          resolvedSide === 'bottom' &&
            'inset-x-0 bottom-0 max-h-[min(85vh,520px)] rounded-t-2xl border-t pb-[var(--dnd-safe-bottom)]',
          resolvedSide === 'right' &&
            'right-0 top-0 h-full w-full max-w-md border-l pt-[var(--dnd-safe-top)]'
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-dnd-gold/15 px-4 py-3">
          {title ? (
            <h2 id="dnd-sheet-title" className="font-display text-lg text-dnd-gold">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg px-2 py-1 font-ui text-sm text-dnd-parchment-muted transition hover:bg-dnd-mist hover:text-dnd-parchment"
          >
            Fechar
          </button>
        </div>
        <div
          className={cn(
            'min-h-0 overflow-y-auto p-4',
            resolvedSide === 'bottom' ? 'flex-1' : 'flex-1'
          )}
        >
          {children}
        </div>
      </div>
    </>
  );
}
