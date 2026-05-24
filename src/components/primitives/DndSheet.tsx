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
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal
        className={cn(
          'fixed z-50 dnd-surface-glass shadow-[var(--dnd-shadow-elevated)]',
          resolvedSide === 'bottom' &&
            'inset-x-0 bottom-0 max-h-[85vh] rounded-t-xl border-t border-dnd-gold/20 pb-[var(--dnd-safe-bottom)]',
          resolvedSide === 'right' &&
            'right-0 top-0 h-full w-full max-w-md border-l border-dnd-gold/20 pt-[var(--dnd-safe-top)]'
        )}
      >
        <div className="flex items-center justify-between border-b border-dnd-gold/15 px-4 py-3">
          {title ? <h2 className="font-display text-lg text-dnd-gold">{title}</h2> : <span />}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="font-ui text-sm text-dnd-parchment-muted hover:text-dnd-parchment"
          >
            Fechar
          </button>
        </div>
        <div className="overflow-y-auto p-4" style={{ maxHeight: resolvedSide === 'bottom' ? 'calc(85vh - 56px)' : 'calc(100vh - 56px)' }}>
          {children}
        </div>
      </div>
    </>
  );
}
