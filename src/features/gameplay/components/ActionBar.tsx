'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, PenLine } from 'lucide-react';
import { DndButton } from '@/components/primitives';
import { cn } from '@/lib/utils';

export interface ActionBarProps {
  options: string[];
  onSelect?: (index: number, text: string) => void;
  onFreeAction?: () => void;
  disabled?: boolean;
  statusLabel?: string;
  className?: string;
}

const SLOT_COUNT = 4;

export function ActionBar({
  options,
  onSelect,
  onFreeAction,
  disabled = false,
  statusLabel,
  className,
}: ActionBarProps) {
  const pageCount = Math.max(1, Math.ceil(options.length / SLOT_COUNT));
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage((p) => Math.min(p, pageCount - 1));
  }, [pageCount, options.length]);

  const visibleOptions = useMemo(() => {
    const start = page * SLOT_COUNT;
    return Array.from({ length: SLOT_COUNT }, (_, i) => {
      const globalIndex = start + i;
      const text = options[globalIndex];
      if (!text) return { text: null as string | null, globalIndex };
      return { text, globalIndex };
    });
  }, [options, page]);

  const hasCarousel = options.length > SLOT_COUNT;

  return (
    <footer
      className={cn(
        'flex flex-col gap-2 border-t border-dnd-gold/15 dnd-surface-glass px-2 py-2 pb-[calc(0.5rem+var(--dnd-safe-bottom))] md:px-4',
        className
      )}
    >
      {statusLabel ? (
        <p className="text-center font-ui text-xs text-dnd-parchment-muted animate-pulse">{statusLabel}</p>
      ) : null}
      {hasCarousel ? (
        <div className="flex items-center justify-between gap-1 px-0.5">
          <button
            type="button"
            aria-label="Opções anteriores"
            disabled={disabled || page <= 0}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-dnd-parchment-muted transition hover:text-dnd-gold disabled:opacity-30"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="font-ui text-[10px] uppercase tracking-wider text-dnd-parchment-muted">
            {page + 1} / {pageCount}
          </span>
          <button
            type="button"
            aria-label="Próximas opções"
            disabled={disabled || page >= pageCount - 1}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-dnd-parchment-muted transition hover:text-dnd-gold disabled:opacity-30"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {visibleOptions.map(({ text, globalIndex }, slotIndex) => (
          <DndButton
            key={`${page}-${slotIndex}`}
            variant={text ? 'goldOutline' : 'ghost'}
            size="sm"
            disabled={disabled || !text}
            className="h-auto min-h-[44px] whitespace-normal px-2 py-2 text-left text-xs leading-snug md:text-center md:text-sm"
            onClick={() => text && onSelect?.(globalIndex, text)}
          >
            {text ?? '—'}
          </DndButton>
        ))}
      </div>
      <DndButton
        variant="ghost"
        size="sm"
        className="w-full"
        disabled={disabled}
        onClick={onFreeAction}
      >
        <PenLine className="h-4 w-4" />
        Ação livre
      </DndButton>
    </footer>
  );
}
