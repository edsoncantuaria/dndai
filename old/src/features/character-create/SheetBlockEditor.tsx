'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { DndButton } from '@/components/primitives';
import { cn } from '@/lib/utils';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import type { SheetBlockDef } from './sheetBlocks';
import { isBlockComplete } from './sheetBlocks';
import type { useCharacterCreator } from '@/hooks/character-creation/useCharacterCreator';
import { canProceedFromStep } from './stepCompleteness';

export function SheetBlockEditor({
  block,
  hook,
  open,
  onClose,
  children,
}: {
  block: SheetBlockDef | null;
  hook: ReturnType<typeof useCharacterCreator>;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { isLgUp } = useBreakpoint();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [open, block?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const canClose =
    !block || isBlockComplete(block.step, hook) || canProceedFromStep(block.step, hook);

  return (
    <AnimatePresence>
      {open && block ? (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm"
            aria-label="Fechar editor"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal
            aria-labelledby="sheet-block-title"
            initial={isLgUp ? { x: '100%', opacity: 0.8 } : { y: '100%' }}
            animate={isLgUp ? { x: 0, opacity: 1 } : { y: 0 }}
            exit={isLgUp ? { x: '100%', opacity: 0.8 } : { y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className={cn(
              'fixed z-[130] flex flex-col bg-dnd-obsidian shadow-[var(--dnd-shadow-elevated)]',
              isLgUp
                ? 'inset-y-0 right-0 w-full max-w-xl border-l border-dnd-gold/20'
                : 'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl border-t border-dnd-gold/25',
            )}
          >
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-dnd-gold/15 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="font-ui text-[10px] font-bold uppercase tracking-[0.24em] text-dnd-ember">
                  Editar bloco
                </p>
                <h2 id="sheet-block-title" className="truncate font-display text-lg text-dnd-parchment">
                  {block.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-dnd-parchment-muted hover:bg-dnd-mist hover:text-dnd-parchment"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
              {children}
            </div>

            <footer className="shrink-0 border-t border-dnd-gold/15 px-4 py-3 pb-[calc(0.75rem+var(--dnd-safe-bottom))] sm:px-5">
              {!canClose ? (
                <p className="mb-2 font-ui text-xs text-dnd-parchment-muted">
                  Complete as escolas obrigatórias deste bloco para continuar.
                </p>
              ) : null}
              <DndButton variant="ember" className="w-full" onClick={onClose} disabled={!canClose}>
                {isBlockComplete(block.step, hook) ? 'Concluído — fechar' : 'Salvar e fechar'}
              </DndButton>
            </footer>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
