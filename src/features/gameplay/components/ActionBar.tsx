'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Loader2, PenLine, Swords, X } from 'lucide-react';
import { DndButton } from '@/components/primitives';
import { cn } from '@/lib/utils';

export interface ActionBarProps {
  options: string[];
  onSelect?: (index: number, text: string) => void;
  onFreeAction?: () => void;
  disabled?: boolean;
  statusLabel?: string;
  /** Conteúdo extra no painel expandido (atalhos SRD, loja, etc.) */
  panelHeader?: ReactNode;
  className?: string;
}

const SLOT_COUNT = 4;

export function ActionBar({
  options,
  onSelect,
  onFreeAction,
  disabled = false,
  statusLabel,
  panelHeader,
  className,
}: ActionBarProps) {
  const [open, setOpen] = useState(false);
  const pageCount = Math.max(1, Math.ceil(options.length / SLOT_COUNT));
  const [page, setPage] = useState(0);

  const filledCount = useMemo(
    () => options.filter((o) => typeof o === 'string' && o.trim()).length,
    [options]
  );

  useEffect(() => {
    setPage((p) => Math.min(p, pageCount - 1));
  }, [pageCount, options.length]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

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

  const handleSelect = (globalIndex: number, text: string) => {
    onSelect?.(globalIndex, text);
    setOpen(false);
  };

  const handleFreeAction = () => {
    onFreeAction?.();
    setOpen(false);
  };

  return (
    <>
      {/* Desktop/tablet: mantém ActionBar antigo (rodapé) */}
      <footer
        className={cn(
          'hidden md:flex md:flex-col md:gap-2 md:border-t md:border-dnd-gold/15 md:dnd-surface-glass md:px-2 md:py-2 md:pb-[calc(0.5rem+var(--dnd-safe-bottom))] md:px-4',
          className
        )}
      >
        {statusLabel ? (
          <p className="text-center font-ui text-xs text-dnd-parchment-muted animate-pulse">{statusLabel}</p>
        ) : null}
        {panelHeader ? <div className="space-y-2">{panelHeader}</div> : null}
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

      {/* Mobile: FloatingActionButton */}
      {open ? (
        <button
          type="button"
          aria-label="Fechar opções de ação"
          className="pointer-events-auto fixed inset-0 z-[35] bg-dnd-obsidian/50 backdrop-blur-[1px] md:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div
        className={cn(
          'pointer-events-none fixed z-40 flex flex-col items-end gap-2 md:hidden',
          'right-[max(0.75rem,var(--dnd-safe-right))]',
          'max-md:bottom-[calc(var(--dnd-safe-bottom)+3.75rem)]',
          'bottom-[max(1rem,calc(var(--dnd-safe-bottom)+0.5rem))]',
          className
        )}
        role="group"
        aria-label="Ações disponíveis"
      >
        {open ? (
          <div
            className={cn(
              'pointer-events-auto w-[min(calc(100vw-1.5rem),24rem)]',
              'rounded-2xl border border-dnd-gold/20 dnd-surface-glass shadow-[0_12px_40px_rgba(0,0,0,0.55)]',
              'flex max-h-[min(58vh,28rem)] flex-col gap-2 overflow-hidden p-3',
              'animate-fadeInSlideUp'
            )}
          >
            <div className="flex items-center justify-between gap-2 border-b border-dnd-gold/10 pb-2">
              <p className="font-display text-sm tracking-wide text-dnd-gold">Ações</p>
              <button
                type="button"
                aria-label="Fechar"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-dnd-parchment-muted transition hover:bg-dnd-gold/10 hover:text-dnd-gold"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {panelHeader ? <div className="mb-2 space-y-2 border-b border-dnd-gold/10 pb-2">{panelHeader}</div> : null}

              {statusLabel ? (
                <p className="mb-2 text-center font-ui text-xs text-dnd-parchment-muted animate-pulse">
                  {statusLabel}
                </p>
              ) : null}

              {hasCarousel ? (
                <div className="mb-2 flex items-center justify-between gap-1 px-0.5">
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

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {visibleOptions.map(({ text, globalIndex }, slotIndex) => (
                  <DndButton
                    key={`${page}-${slotIndex}`}
                    variant={text ? 'goldOutline' : 'ghost'}
                    size="sm"
                    disabled={disabled || !text}
                    className="h-auto min-h-[44px] whitespace-normal px-2 py-2 text-left text-xs leading-snug"
                    onClick={() => text && handleSelect(globalIndex, text)}
                  >
                    {text ?? '—'}
                  </DndButton>
                ))}
              </div>
            </div>

            <DndButton
              variant="ghost"
              size="sm"
              className="w-full shrink-0 border-t border-dnd-gold/10 pt-2"
              disabled={disabled}
              onClick={handleFreeAction}
            >
              <PenLine className="h-4 w-4" />
              Ação livre
            </DndButton>
          </div>
        ) : null}

        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={open ? 'Fechar menu de ações' : 'Abrir menu de ações do Mestre'}
          disabled={disabled && !open}
          className={cn(
            'pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full',
            'border border-dnd-gold/50 bg-dnd-ember text-white shadow-[0_8px_28px_var(--dnd-ember-glow)]',
            'transition-all duration-[var(--dnd-duration-ui)] hover:bg-dnd-ember-hover hover:scale-[1.03] active:scale-[0.97]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dnd-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-dnd-obsidian',
            'disabled:opacity-45 disabled:hover:scale-100',
            open && 'rotate-0 bg-dnd-obsidian-glass text-dnd-gold ring-2 ring-dnd-gold/40'
          )}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-6 w-6" strokeWidth={2} /> : disabled && statusLabel ? (
            <Loader2 className="h-6 w-6 animate-spin" strokeWidth={2} />
          ) : (
            <Swords className="h-6 w-6" strokeWidth={2} />
          )}
          {!open && filledCount > 0 ? (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-dnd-gold px-1 font-ui text-[10px] font-bold text-dnd-obsidian"
              aria-hidden
            >
              {filledCount > 9 ? '9+' : filledCount}
            </span>
          ) : null}
        </button>
      </div>
    </>
  );
}
